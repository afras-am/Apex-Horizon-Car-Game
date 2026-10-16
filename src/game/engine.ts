import { CARS, RIVAL_COLORS, THEMES } from './themes';
import type { CarSpec, SpriteKind, Theme } from './themes';
import { drawCar, shade } from './carDraw';
import type { CarStyle } from './carDraw';
import { drawSprite, SPRITE_INFO } from './sprites';
import { GameAudio } from './audio';

// ---------------------------------------------------------------- constants
const SEG = 200;
const RUMBLE = 3;
const ROAD_W = 2000;
const LANES = 3;
const FOV = 100;
const CAM_H = 1000;
const DRAW = 240;
const STEP = 1 / 60;
const MAX_SPEED = SEG / STEP; // 12000 units/s
const CENTRIFUGAL = 0.2;
const PLAYER_W = 0.24;
const CAR_W = 0.24;
const BASE_DEPTH = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const PLAYER_Z = CAM_H * BASE_DEPTH;
const LINE_DIST = 1200; // distance from the grid to the start/finish line
const PAD = 14;
const RIVAL_COUNT = 11;
const FOG_DENSITY = 3.4;

export type GameState = 'attract' | 'countdown' | 'racing' | 'finished';

export interface RaceResult {
  position: number;
  racers: number;
  total: number;
  laps: number[];
  bestLap: number;
  topSpeed: number;
  themeId: string;
  laps_n: number;
}

interface P {
  wy: number;
  wz: number;
  cx: number;
  cy: number;
  cz: number;
  sx: number;
  sy: number;
  sw: number;
  sc: number;
}
interface SprObj {
  kind: SpriteKind;
  offset: number;
  v: number;
}
interface Orb {
  offset: number;
  taken: boolean;
}
interface Car {
  id: number;
  offset: number;
  z: number;
  dist: number;
  speed: number;
  base: number;
  percent: number;
  w: number;
  style: CarStyle;
}
interface Seg {
  index: number;
  p1: P;
  p2: P;
  curve: number;
  sprites: SprObj[];
  cars: Car[];
  orb: Orb | null;
  fog: number;
  clip: number;
  mark: number;
  alt: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  add: boolean;
}

// ---------------------------------------------------------------- helpers
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeIn = (a: number, b: number, p: number) => a + (b - a) * p * p;
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
const pct = (z: number, len: number) => (z % len) / len;

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function overlap(x1: number, w1: number, x2: number, w2: number, percent = 1) {
  const half = percent / 2;
  return !(x1 + w1 * half < x2 - w2 * half || x1 - w1 * half > x2 + w2 * half);
}

function mkP(wy: number, wz: number): P {
  return { wy, wz, cx: 0, cy: 0, cz: 0, sx: 0, sy: 0, sw: 0, sc: 0 };
}

export function fmtTime(t: number) {
  if (!isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const c = Math.floor((t * 100) % 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- engine
export class RaceEngine {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  audio = new GameAudio();
  onFinish: (r: RaceResult) => void = () => {};

  input = { left: false, right: false, gas: false, brake: false, boost: false };
  state: GameState = 'attract';
  paused = false;

  private W = 1280;
  private H = 720;
  private hz = 300;
  private ui = 1;

  private theme: Theme = THEMES[0];
  private car: CarSpec = CARS[0];
  private laps = 3;

  private segments: Seg[] = [];
  private trackLength = 0;
  private rivals: Car[] = [];

  // player
  private position = 0;
  private dist = 0;
  private playerX = 0;
  private speed = 0;
  private steerVis = 0;
  private nitro = 0.7;
  private boostAmt = 0;
  private boosting = false;
  private time = 0;
  private raceTime = 0;
  private lapStart = 0;
  private lapDone = -1;
  private lapTimes: number[] = [];
  private rank = 1;
  private topSpeed = 0;
  private crashCd = 0;
  private shake = 0;
  private drafting = false;
  private draftCd = 0;
  private offroad = false;
  private cdTime = 0;
  private cdLast = 4;
  private finishTimer = 0;
  private finalRank = 1;
  private offFar = 0;
  private offNear = 0;
  private toasts: { text: string; color: string; t: number; dur: number }[] = [];
  private particles: Particle[] = [];
  private gearDisp = 1;

  // cached art
  private sky!: HTMLCanvasElement;
  private farL!: HTMLCanvasElement;
  private nearL!: HTMLCanvasElement;
  private vignette!: HTMLCanvasElement;

  private raf = 0;
  private lastTs = 0;
  private acc = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext('2d', { alpha: false });
    if (!c) throw new Error('Canvas 2D not supported');
    this.ctx = c;
    this.resize();
    this.setup(0, 0, 3);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.audio.stopMusic();
    this.audio.silenceEngine();
  }

  // ------------------------------------------------------------ public API
  setup(themeIdx: number, carIdx: number, laps: number) {
    this.theme = THEMES[themeIdx] ?? THEMES[0];
    this.car = CARS[carIdx] ?? CARS[0];
    this.laps = laps;
    this.buildTrack();
    this.buildBackground();
    this.reset();
    this.state = 'attract';
    if (this.audio.ctx) this.audio.startMusic(this.theme.bpm, this.theme.transpose);
  }

  ensureAudio() {
    const first = !this.audio.ctx;
    this.audio.init();
    if (first) this.audio.startMusic(this.theme.bpm, this.theme.transpose);
  }

  start() {
    this.ensureAudio();
    this.reset();
    this.state = 'countdown';
    this.cdTime = 0;
    this.cdLast = -1;
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.audio.setPaused(p);
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    return this.audio.muted;
  }

  // ------------------------------------------------------------ input
  private onKey = (e: KeyboardEvent) => {
    const d = e.type === 'keydown';
    let used = true;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = d;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = d;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.input.gas = d;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.input.brake = d;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
      case 'Space':
        this.input.boost = d;
        break;
      default:
        used = false;
    }
    if (used) e.preventDefault();
  };

  private onResize = () => {
    this.resize();
    this.buildBackground();
  };

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const cw = window.innerWidth;
    const ch = window.innerHeight;
    const scale = Math.min(dpr, 1700 / cw, 960 / ch);
    this.W = Math.max(320, Math.round(cw * scale));
    this.H = Math.max(240, Math.round(ch * scale));
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.hz = Math.round(this.H * 0.42);
    this.ui = this.H / 720;
  }

  // ------------------------------------------------------------ track
  private buildTrack() {
    const th = this.theme;
    const rnd = mulberry32(th.seed);
    const segs: Seg[] = [];
    this.segments = segs;
    const lastY = () => (segs.length ? segs[segs.length - 1].p2.wy : 0);
    const add = (curve: number, y: number) => {
      const n = segs.length;
      segs.push({
        index: n,
        p1: mkP(lastY(), n * SEG),
        p2: mkP(y, (n + 1) * SEG),
        curve,
        sprites: [],
        cars: [],
        orb: null,
        fog: 0,
        clip: 0,
        mark: 0,
        alt: Math.floor(n / RUMBLE) % 2,
      });
    };
    const road = (enter: number, hold: number, leave: number, curve: number, y: number) => {
      const startY = lastY();
      const endY = startY + y * SEG;
      const total = enter + hold + leave;
      for (let n = 0; n < enter; n++) add(easeIn(0, curve, n / enter), easeInOut(startY, endY, n / total));
      for (let n = 0; n < hold; n++) add(curve, easeInOut(startY, endY, (enter + n) / total));
      for (let n = 0; n < leave; n++)
        add(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n) / total));
    };
    const rr = (a: number, b: number) => Math.floor(a + rnd() * (b - a + 1));
    const sign = () => (rnd() < 0.5 ? -1 : 1);

    road(25, 25, 25, 0, 0);
    let lastCurveSign = 1;
    while (segs.length < 2500) {
      const r = rnd();
      const yNow = lastY() / SEG;
      const hillDir = yNow > 36 ? -1 : yNow < -8 ? 1 : sign();
      if (r < 0.1) {
        const n = rr(14, 26);
        road(n, n, n, 0, 0);
      } else if (r < 0.28) {
        const h = [20, 40, 60][rr(0, 2)];
        const n = rr(22, 34);
        road(n, n, n, 0, hillDir * h);
      } else if (r < 0.42) {
        road(25, 25, 25, 0, hillDir * 20);
        road(25, 25, 25, 0, -hillDir * 26);
      } else if (r < 0.66) {
        lastCurveSign = -lastCurveSign;
        const c = [2, 3.5, 5][rr(0, 2)] * lastCurveSign;
        const n = rr(18, 38);
        road(n, n, n, c, rnd() < 0.4 ? hillDir * 20 : 0);
      } else if (r < 0.8) {
        // S-curve
        const c = [2.5, 4][rr(0, 1)];
        const s = sign();
        road(22, 22, 22, c * s, 0);
        road(22, 22, 22, -c * s * 1.2, 0);
        road(22, 22, 22, c * s * 0.8, 0);
      } else if (r < 0.9) {
        // bumps
        road(8, 8, 8, 0, 5);
        road(8, 8, 8, 0, -2);
        road(8, 8, 8, 0, -5);
        road(8, 8, 8, 0, 8);
        road(8, 8, 8, 0, -8);
        road(8, 8, 8, 0, 4);
      } else {
        // long fast sweeper
        lastCurveSign = -lastCurveSign;
        road(40, 60, 40, 2 * lastCurveSign, hillDir * 12);
      }
    }
    road(70, 70, 70, 0, -lastY() / SEG);
    // make sure the lap closes on y = 0
    const end = segs[segs.length - 1];
    end.p2.wy = 0;
    this.trackLength = segs.length * SEG;

    segs[0].mark = 1;
    segs[1].mark = 2;

    // scenery
    const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
    const len = segs.length;
    for (let n = 4; n < len; n++) {
      const s = segs[n];
      if (n % 4 === 0) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.75) s.sprites.push({ kind: pick(th.deco), offset: side * (1.35 + rnd() * 2.0), v: rnd() });
        }
      }
      if (n % 3 === 0 && rnd() < 0.22) {
        const side = sign();
        s.sprites.push({ kind: pick(th.deco), offset: side * (3.6 + rnd() * 6), v: rnd() });
      }
      if (th.lamps && n % 10 === 5) {
        s.sprites.push({ kind: 'lamp', offset: -1.28, v: 0 });
        s.sprites.push({ kind: 'lamp', offset: 1.28, v: 0 });
      }
      if (th.billboards && n % 85 === 40) {
        const side = sign();
        s.sprites.push({ kind: 'billboard', offset: side * 1.95, v: rnd() });
      }
      if (th.towers && n % 3 === 0) {
        for (const side of [-1, 1]) {
          if (rnd() < 0.8) s.sprites.push({ kind: 'tower', offset: side * (2.9 + rnd() * 4.5), v: rnd() });
        }
      }
    }
    segs[0].sprites.push({ kind: 'gate', offset: 0, v: 0 });
    segs[len - 40].sprites.push({ kind: 'billboard', offset: 1.95, v: 0.3 });

    // nitro orbs
    for (let n = 70; n < len - 60; n += rr(110, 170)) {
      const offset = [-0.55, 0, 0.55][rr(0, 2)];
      for (let k = 0; k < 3; k++) segs[n + k * 4].orb = { offset, taken: false };
    }
  }

  private findSeg(z: number) {
    const L = this.trackLength;
    const zz = ((z % L) + L) % L;
    return this.segments[Math.floor(zz / SEG) % this.segments.length];
  }

  // ------------------------------------------------------------ reset
  private reset() {
    for (const s of this.segments) {
      s.cars = [];
      if (s.orb) s.orb.taken = false;
    }
    const L = this.trackLength;
    this.position = L - LINE_DIST - PLAYER_Z;
    this.dist = 0;
    this.playerX = 0;
    this.speed = 0;
    this.steerVis = 0;
    this.nitro = this.car.nitro * 0.7;
    this.boostAmt = 0;
    this.boosting = false;
    this.time = 0;
    this.raceTime = 0;
    this.lapStart = 0;
    this.lapDone = -1;
    this.lapTimes = [];
    this.rank = RIVAL_COUNT + 1;
    this.topSpeed = 0;
    this.shake = 0;
    this.toasts = [];
    this.particles = [];
    this.finishTimer = 0;
    this.offFar = 0;
    this.offNear = 0;
    this.cdTime = 0;

    // rivals on the grid
    const rnd = mulberry32(this.theme.seed + 7);
    this.rivals = [];
    for (let i = 0; i < RIVAL_COUNT; i++) {
      const row = i;
      const dist = 520 + row * 430;
      const base = MAX_SPEED * clamp(0.97 - (RIVAL_COUNT - 1 - i) * 0.036 + (rnd() - 0.5) * 0.03, 0.5, 0.99);
      const car: Car = {
        id: i,
        offset: i % 2 ? 0.48 : -0.48,
        z: 0,
        dist,
        speed: 0,
        base,
        percent: 0,
        w: CAR_W,
        style: RIVAL_COLORS[i % RIVAL_COLORS.length],
      };
      car.z = (L - LINE_DIST + dist) % L;
      car.percent = pct(car.z, SEG);
      this.findSeg(car.z).cars.push(car);
      this.rivals.push(car);
    }
  }

  // ------------------------------------------------------------ backgrounds
  private buildBackground() {
    const W = this.W;
    const H = this.H;
    const hz = this.hz;
    const th = this.theme;
    const mk = (w: number, h: number) => {
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(w));
      c.height = Math.max(1, Math.round(h));
      return c;
    };

    // sky (with padding)
    const sh = hz + PAD + 2;
    const sky = mk(W + PAD * 2, sh);
    const sc = sky.getContext('2d')!;
    const g = sc.createLinearGradient(0, 0, 0, sh);
    th.sky.forEach((c, i) => g.addColorStop(i / (th.sky.length - 1), c));
    sc.fillStyle = g;
    sc.fillRect(0, 0, sky.width, sh);
    const rnd = mulberry32(th.seed + 99);
    if (th.stars) {
      for (let i = 0; i < 160; i++) {
        const x = rnd() * sky.width;
        const y = rnd() * sh * 0.55;
        sc.globalAlpha = 0.25 + rnd() * 0.75;
        sc.fillStyle = '#fff';
        const r = rnd() < 0.1 ? 1.8 : 1;
        sc.fillRect(x, y, r, r);
      }
      sc.globalAlpha = 1;
    }
    // clouds
    sc.fillStyle = th.cloud;
    for (let i = 0; i < 9; i++) {
      const cx = rnd() * sky.width;
      const cy = sh * (0.12 + rnd() * 0.5);
      const cw = (60 + rnd() * 200) * this.ui;
      const ch = (5 + rnd() * 9) * this.ui;
      sc.globalAlpha = th.stars ? 0.1 + rnd() * 0.12 : 0.35 + rnd() * 0.3;
      for (let k = 0; k < 4; k++) {
        sc.beginPath();
        sc.ellipse(cx + (k - 1.5) * cw * 0.25, cy + (k % 2) * ch * 0.4, cw * (0.5 - k * 0.07), ch * (1 + (k % 2) * 0.6), 0, 0, 7);
        sc.fill();
      }
    }
    sc.globalAlpha = 1;
    // sun
    const R = Math.min(W, H * 1.4) * 0.17;
    const sx = PAD + W * 0.64;
    const sy = PAD + hz - R * 0.28;
    const glow = sc.createRadialGradient(sx, sy, R * 0.5, sx, sy, R * 3.4);
    glow.addColorStop(0, th.sun[1] + 'aa');
    glow.addColorStop(0.35, th.sun[1] + '40');
    glow.addColorStop(1, th.sun[1] + '00');
    sc.globalCompositeOperation = 'lighter';
    sc.fillStyle = glow;
    sc.fillRect(0, 0, sky.width, sh);
    sc.globalCompositeOperation = 'source-over';
    const sunC = mk(R * 2, R * 2);
    const su = sunC.getContext('2d')!;
    const sg = su.createLinearGradient(0, 0, 0, R * 2);
    sg.addColorStop(0, th.sun[0]);
    sg.addColorStop(1, th.sun[1]);
    su.fillStyle = sg;
    su.beginPath();
    su.arc(R, R, R, 0, 7);
    su.fill();
    if (th.sunStripes) {
      su.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 7; i++) {
        const y = R * (0.85 + i * 0.17);
        su.fillRect(0, y, R * 2, R * 0.025 * (i + 1) + 1);
      }
    }
    sc.drawImage(sunC, sx - R, sy - R);
    this.sky = sky;

    // parallax layers
    const LW = W * 2;
    const layer = (kind: string, hh: number, c: [string, string], seed: number, windows: boolean, haze: number) => {
      const cv = mk(LW, hh);
      const x = cv.getContext('2d')!;
      const r = mulberry32(seed);
      const gg = x.createLinearGradient(0, 0, 0, hh);
      gg.addColorStop(0, c[0]);
      gg.addColorStop(1, c[1]);
      x.fillStyle = gg;
      const ph = [r() * 6, r() * 6, r() * 6, r() * 6];
      if (kind === 'city') {
        let px = 0;
        while (px < LW) {
          const bw = (22 + r() * 56) * this.ui;
          const bh = hh * (0.2 + Math.pow(r(), 1.6) * 0.8);
          x.fillStyle = gg;
          x.fillRect(px, hh - bh, bw, bh);
          if (windows) {
            for (let wy = hh - bh + 6; wy < hh - 6; wy += 7 * this.ui) {
              for (let wx = px + 4; wx < px + bw - 5; wx += 7 * this.ui) {
                if (r() > 0.55) {
                  x.fillStyle = r() > 0.8 ? th.accent[1] : r() > 0.5 ? th.accent[0] : '#ffe9a8';
                  x.globalAlpha = 0.8;
                  x.fillRect(wx, wy, 3 * this.ui, 3.5 * this.ui);
                }
              }
            }
            x.globalAlpha = 1;
          }
          if (r() > 0.6) {
            x.fillStyle = th.accent[r() > 0.5 ? 0 : 1];
            x.globalAlpha = 0.9;
            x.fillRect(px, hh - bh, bw, 2 * this.ui);
            x.globalAlpha = 1;
          }
          px += bw + (r() < 0.2 ? 3 * this.ui : 0);
        }
      } else {
        x.beginPath();
        x.moveTo(0, hh);
        for (let px = 0; px <= LW; px += 4) {
          const t = (px / LW) * Math.PI * 2;
          let v: number;
          if (kind === 'mountains') {
            const ridge = (k: number, p: number) => 1 - Math.abs(Math.sin(t * k * 0.5 + p));
            v = 0.42 * ridge(5, ph[0]) + 0.28 * ridge(11, ph[1]) + 0.14 * ridge(27, ph[2]) + 0.1 * Math.sin(t * 3 + ph[3]) + 0.06;
          } else {
            const raw = 0.5 + 0.32 * Math.sin(t * 6 + ph[0]) + 0.22 * Math.sin(t * 13 + ph[1]) + 0.12 * Math.sin(t * 31 + ph[2]);
            const s = clamp((raw - 0.48) / 0.12, 0, 1);
            v = 0.12 + (s * s * (3 - 2 * s)) * 0.55 + raw * 0.1;
          }
          x.lineTo(px, hh - clamp(v, 0.02, 1) * hh * 0.95);
        }
        x.lineTo(LW, hh);
        x.closePath();
        x.fill();
        if (kind === 'mesas') {
          x.globalCompositeOperation = 'source-atop';
          x.fillStyle = 'rgba(0,0,0,0.12)';
          for (let sy2 = hh * 0.15; sy2 < hh; sy2 += hh * 0.13) x.fillRect(0, sy2, LW, hh * 0.035);
          x.globalCompositeOperation = 'source-over';
        }
      }
      // atmospheric haze
      x.globalCompositeOperation = 'source-atop';
      const hg = x.createLinearGradient(0, hh * 0.1, 0, hh);
      hg.addColorStop(0, th.fog + '00');
      hg.addColorStop(1, th.fog);
      x.globalAlpha = haze;
      x.fillStyle = hg;
      x.fillRect(0, 0, LW, hh);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
      return cv;
    };
    const kind = th.layer;
    this.farL = layer(kind, H * (kind === 'city' ? 0.22 : 0.26), th.far, th.seed + 1, kind === 'city', 0.75);
    this.nearL = layer(kind === 'city' ? 'city' : 'mountains', H * (kind === 'city' ? 0.16 : 0.17), th.near, th.seed + 2, kind === 'city', 0.5);
    if (kind === 'mesas') {
      this.nearL = layer('mesas', H * 0.15, th.near, th.seed + 5, false, 0.45);
    }

    // vignette
    const vg = mk(W, H);
    const vx = vg.getContext('2d')!;
    const rg = vx.createRadialGradient(W / 2, H * 0.5, H * 0.35, W / 2, H * 0.5, Math.max(W, H) * 0.75);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.6)');
    vx.fillStyle = rg;
    vx.fillRect(0, 0, W, H);
    this.vignette = vg;
  }

  // ------------------------------------------------------------ loop
  private loop = (ts: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const now = ts / 1000;
    const dt = Math.min(0.1, now - (this.lastTs || now));
    this.lastTs = now;
    if (!this.paused) {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= STEP && guard++ < 6) {
        this.update(STEP);
        this.acc -= STEP;
      }
      if (guard >= 6) this.acc = 0;
      const inRace = this.state === 'racing' || this.state === 'countdown';
      const throttle = inRace && (this.input.gas || this.boosting) ? 1 : 0;
      this.audio.setEngine(this.speed / MAX_SPEED, this.state === 'attract' ? 0.4 : throttle, this.boostAmt, this.offroad);
    }
    this.render();
  };

  // ------------------------------------------------------------ update
  private update(dt: number) {
    const L = this.trackLength;
    this.time += dt;
    const ps = this.findSeg(this.position + PLAYER_Z);
    const prevIdx = ps.index;
    const speedPct = this.speed / MAX_SPEED;
    const inp = this.input;
    const car = this.car;
    const racing = this.state === 'racing';
    const auto = this.state === 'attract' || this.state === 'finished';

    // countdown
    if (this.state === 'countdown') {
      this.cdTime += dt;
      const n = Math.floor(this.cdTime);
      if (n !== this.cdLast) {
        this.cdLast = n;
        if (n < 3) this.audio.beep(false);
        else if (n === 3) {
          this.audio.beep(true);
          this.state = 'racing';
          this.raceTime = 0;
          this.toast('GO!', '#5dff9a', 1);
        }
      }
    }
    if (this.state === 'racing') this.raceTime += dt;

    // rivals
    if (this.state !== 'countdown') this.updateRivals(dt, ps);

    // movement
    const dz = dt * this.speed;
    this.position = (this.position + dz) % L;
    this.dist += dz;
    const dx = dt * 2 * speedPct;

    this.boosting = false;
    if (racing) {
      const steerIn = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      this.steerVis += (steerIn - this.steerVis) * Math.min(1, dt * 9);
      this.playerX += dx * steerIn * car.grip * 1.18;
      this.playerX -= dx * speedPct * ps.curve * CENTRIFUGAL;

      const canBoost = inp.boost && this.nitro > 0.005 && (inp.gas || this.speed > MAX_SPEED * 0.2);
      this.boosting = canBoost;
      const maxCur = MAX_SPEED * car.top * (canBoost ? 1.32 : 1);
      const base = (MAX_SPEED / 3.1) * car.accel;
      if (canBoost) {
        this.nitro = Math.max(0, this.nitro - dt * 0.3);
        if (this.speed < maxCur) this.speed = Math.min(maxCur, this.speed + base * 2.6 * dt);
      } else if (inp.gas) {
        const taper = Math.max(0.28, 1 - Math.pow(this.speed / (MAX_SPEED * car.top), 2.2) * 0.8);
        if (this.speed < maxCur) this.speed = Math.min(maxCur, this.speed + base * taper * dt);
      } else {
        this.speed -= (MAX_SPEED / 5) * dt;
      }
      if (inp.brake) this.speed -= MAX_SPEED * 0.95 * dt;
      if (this.speed > maxCur) this.speed = Math.max(maxCur, this.speed - MAX_SPEED * 0.35 * dt);
      if (!canBoost) this.nitro = Math.min(car.nitro, this.nitro + dt * 0.035);

      this.offroad = (this.playerX < -1 || this.playerX > 1) && this.speed > 0;
      if (this.offroad && this.speed > MAX_SPEED / 4) this.speed -= (MAX_SPEED / 2) * dt;
      this.speed = Math.max(0, this.speed);
      this.playerX = clamp(this.playerX, -3, 3);

      const cur = this.findSeg(this.position + PLAYER_Z);
      this.collide(cur, prevIdx);
      this.checkDraft(cur, dt);
      this.checkOrbs(cur, prevIdx);
      this.lapLogic();
      this.topSpeed = Math.max(this.topSpeed, (this.speed / MAX_SPEED) * 300);
    } else if (auto) {
      const target = this.state === 'finished' ? MAX_SPEED * 0.4 : MAX_SPEED * 0.72;
      this.speed += (target - this.speed) * Math.min(1, dt * 0.8);
      const wantX = this.state === 'finished' ? 0 : Math.sin(this.time * 0.22) * 0.45;
      this.playerX += (wantX - this.playerX) * Math.min(1, dt * 1.2);
      this.steerVis += (clamp((wantX - this.playerX) * 3, -1, 1) - this.steerVis) * Math.min(1, dt * 4);
      this.offroad = false;
      if (this.state === 'finished') {
        this.finishTimer += dt;
        if (this.finishTimer > 2.6 && this.finishTimer < 1000) {
          this.finishTimer = 1000;
          this.onFinish(this.buildResult());
        }
      }
    } else {
      // countdown: stationary
      this.steerVis *= 0.9;
      this.offroad = false;
      this.speed = 0;
    }

    this.boostAmt += ((this.boosting ? 1 : 0) - this.boostAmt) * Math.min(1, dt * (this.boosting ? 6 : 3));
    this.crashCd = Math.max(0, this.crashCd - dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.draftCd = Math.max(0, this.draftCd - dt);
    if (this.boosting) this.shake = Math.max(this.shake, 0.12);

    // rank
    let r = 1;
    for (const c of this.rivals) if (c.dist > this.dist) r++;
    this.rank = r;

    // parallax
    const segsMoved = dz / SEG;
    this.offFar += ps.curve * segsMoved * 0.12 * this.ui;
    this.offNear += ps.curve * segsMoved * 0.4 * this.ui;

    this.updateParticles(dt, speedPct);

    // toasts
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < t.dur);

    this.gearDisp = Math.min(6, Math.floor(Math.min(speedPct / 1.35, 1) * 6) + 1);
  }

  private toast(text: string, color = '#ffffff', dur = 1.6) {
    this.toasts.push({ text, color, t: 0, dur });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  private updateRivals(dt: number, ps: Seg) {
    const L = this.trackLength;
    const playerSeg = ps;
    for (const c of this.rivals) {
      const oldSeg = this.findSeg(c.z);
      c.offset += this.carOffset(c, oldSeg, playerSeg);
      c.offset = clamp(c.offset, -0.88, 0.88);
      const curveSlow = 1 - Math.min(Math.abs(oldSeg.curve), 5) * 0.012;
      let target = c.base * curveSlow;
      const gap = c.dist - this.dist;
      if (this.state === 'racing' || this.state === 'finished') {
        if (gap > 14000) target *= 0.9;
        else if (gap < -9000) target *= 1.07;
      }
      c.speed += (target - c.speed) * Math.min(1, dt * 0.9);
      const d = dt * c.speed;
      c.dist += d;
      c.z = (L - LINE_DIST + c.dist) % L;
      c.percent = pct(c.z, SEG);
      const ns = this.findSeg(c.z);
      if (ns !== oldSeg) {
        const i = oldSeg.cars.indexOf(c);
        if (i >= 0) oldSeg.cars.splice(i, 1);
        ns.cars.push(c);
      }
    }
  }

  private carOffset(c: Car, cs: Seg, ps: Seg) {
    const look = 20;
    for (let i = 1; i < look; i++) {
      const s = this.segments[(cs.index + i) % this.segments.length];
      if (s === ps && c.speed > this.speed && this.state !== 'attract' && overlap(this.playerX, PLAYER_W, c.offset, c.w, 1.2)) {
        const dir = this.playerX > 0.5 ? -1 : this.playerX < -0.5 ? 1 : c.offset > this.playerX ? 1 : -1;
        return ((dir / i) * (c.speed - this.speed)) / MAX_SPEED;
      }
      for (const o of s.cars) {
        if (o !== c && c.speed > o.speed && overlap(c.offset, c.w, o.offset, o.w, 1.2)) {
          const dir = o.offset > 0.5 ? -1 : o.offset < -0.5 ? 1 : c.offset > o.offset ? 1 : -1;
          return ((dir / i) * (c.speed - o.speed)) / MAX_SPEED;
        }
      }
    }
    if (c.offset < -0.8) return 0.01;
    if (c.offset > 0.8) return -0.01;
    return 0;
  }

  private wrapDiff(d: number) {
    const L = this.trackLength;
    if (d > L / 2) d -= L;
    else if (d < -L / 2) d += L;
    return d;
  }

  private collide(ps: Seg, prevIdx: number) {
    const W = this.W;
    const H = this.H;
    // roadside objects
    if ((this.playerX < -1 || this.playerX > 1) && this.crashCd <= 0) {
      const idxs = [ps.index, prevIdx];
      outer: for (const idx of idxs) {
        const seg = this.segments[idx];
        for (const s of seg.sprites) {
          const info = SPRITE_INFO[s.kind];
          if (info.solid > 0 && overlap(this.playerX, PLAYER_W, s.offset, info.solid)) {
            const power = clamp(this.speed / MAX_SPEED, 0.2, 1.2);
            this.speed = Math.min(this.speed * 0.3, MAX_SPEED / 5);
            this.playerX = s.offset + (s.offset > 0 ? -1 : 1) * (info.solid / 2 + PLAYER_W / 2 + 0.06);
            this.hit(power, W * (s.offset > 0 ? 0.62 : 0.38), H * 0.82);
            break outer;
          }
        }
      }
    }
    // rival cars
    if (this.crashCd <= 0) {
      const pz = this.position + PLAYER_Z;
      for (let k = -1; k <= 1; k++) {
        const seg = this.segments[(ps.index + k + this.segments.length) % this.segments.length];
        for (const c of seg.cars) {
          const zd = this.wrapDiff(c.z - pz);
          if (Math.abs(zd) < 170 && overlap(this.playerX, PLAYER_W, c.offset, c.w, 0.85)) {
            const closing = Math.abs(this.speed - c.speed) / MAX_SPEED;
            if (this.speed > c.speed) {
              const newPos = c.z - PLAYER_Z - 190;
              const diff = this.wrapDiff(newPos - this.position);
              this.position = (newPos + this.trackLength) % this.trackLength;
              this.dist += diff;
              this.speed = c.speed * (c.speed / this.speed) * 0.9;
            }
            const away = this.playerX > c.offset ? 1 : -1;
            this.playerX += away * 0.09;
            c.offset -= away * 0.1;
            this.hit(clamp(closing * 1.5 + 0.2, 0.2, 1), W * 0.5 + (c.offset - this.playerX) * W * 0.2, H * 0.78);
            return;
          }
        }
      }
    }
  }

  private hit(power: number, x: number, y: number) {
    this.crashCd = 0.5;
    this.shake = Math.min(1, 0.4 + power * 0.7);
    this.audio.crash(Math.min(1, power));
    const n = Math.round(14 + power * 26);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + Math.random() * 0.8);
      const sp = (200 + Math.random() * 520) * this.ui;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.6,
        max: 1.1,
        size: (2 + Math.random() * 3) * this.ui,
        grow: 0,
        color: Math.random() < 0.5 ? '255,200,90' : '255,120,40',
        add: true,
      });
    }
    this.toast('CRASH!', '#ff4d5e', 1);
  }

  private checkDraft(ps: Seg, dt: number) {
    this.drafting = false;
    if (this.speed < MAX_SPEED * 0.5) return;
    for (let i = 1; i < 12 && !this.drafting; i++) {
      const seg = this.segments[(ps.index + i) % this.segments.length];
      for (const c of seg.cars) {
        if (Math.abs(c.offset - this.playerX) < 0.22) {
          this.drafting = true;
          break;
        }
      }
    }
    if (this.drafting) {
      this.speed = Math.min(this.speed + MAX_SPEED * 0.1 * dt, MAX_SPEED * this.car.top * 1.05);
      this.nitro = Math.min(this.car.nitro, this.nitro + dt * 0.16);
      if (this.draftCd <= 0) {
        this.toast('SLIPSTREAM', '#7df9ff', 1.2);
        this.draftCd = 4;
      }
    }
  }

  private checkOrbs(ps: Seg, prevIdx: number) {
    for (const idx of [ps.index, prevIdx]) {
      const o = this.segments[idx].orb;
      if (o && !o.taken && overlap(this.playerX, PLAYER_W * 1.4, o.offset, 0.3)) {
        o.taken = true;
        this.nitro = Math.min(this.car.nitro, this.nitro + 0.22 * this.car.nitro);
        this.audio.pickup();
        this.toast('+NITRO', '#5ff2ff', 0.9);
      }
    }
  }

  private lapLogic() {
    const idx = Math.floor((this.dist - LINE_DIST) / this.trackLength);
    if (idx > this.lapDone) {
      this.lapDone = idx;
      if (idx === 0) {
        this.lapStart = this.raceTime;
        this.toast('LAP 1', '#ffd166', 1.4);
        this.audio.lap();
        return;
      }
      if (idx >= 1) {
        const lt = this.raceTime - this.lapStart;
        this.lapTimes.push(lt);
        this.lapStart = this.raceTime;
        for (const s of this.segments) if (s.orb) s.orb.taken = false;
        if (idx >= this.laps) {
          this.state = 'finished';
          this.finalRank = this.rank;
          this.finishTimer = 0;
          this.audio.finish();
          this.input.boost = false;
          this.toast('FINISH!', '#ffd166', 3);
        } else {
          this.audio.lap();
          this.toast(idx + 1 === this.laps ? 'FINAL LAP' : `LAP ${idx + 1}`, '#ffd166', 1.6);
        }
      }
    }
  }

  private buildResult(): RaceResult {
    const total = this.lapTimes.reduce((a, b) => a + b, 0);
    return {
      position: this.finalRank,
      racers: RIVAL_COUNT + 1,
      total,
      laps: [...this.lapTimes],
      bestLap: Math.min(...this.lapTimes),
      topSpeed: Math.round(this.topSpeed),
      themeId: this.theme.id,
      laps_n: this.laps,
    };
  }

  private updateParticles(dt: number, speedPct: number) {
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const pw = W * PLAYER_W;
    const py = this.hz + H / 2;
    const ps = this.findSeg(this.position + PLAYER_Z);
    const racing = this.state === 'racing';

    if (racing && this.speed > 200) {
      if (this.offroad && Math.random() < 0.9) {
        const gc = this.theme.grass[0];
        for (const s of [-1, 1]) {
          this.particles.push({
            x: W / 2 + s * pw * 0.42,
            y: py - 4 * ui,
            vx: (Math.random() - 0.5) * 140 * ui + s * 60 * ui,
            vy: (-30 - Math.random() * 150) * ui,
            life: 0.6,
            max: 0.6,
            size: (8 + Math.random() * 14) * ui,
            grow: 40 * ui,
            color: this.rgbOf(shade(gc, 0.25)),
            add: false,
          });
        }
      }
      if (Math.abs(ps.curve) * speedPct > 2.6 && Math.abs(this.steerVis) > 0.2) {
        for (const s of [-1, 1]) {
          this.particles.push({
            x: W / 2 + s * pw * 0.42,
            y: py - 2 * ui,
            vx: (Math.random() - 0.5) * 60 * ui,
            vy: (-10 - Math.random() * 40) * ui,
            life: 0.5,
            max: 0.5,
            size: (6 + Math.random() * 8) * ui,
            grow: 50 * ui,
            color: '230,230,240',
            add: false,
          });
        }
      }
      if (this.boosting) {
        for (const s of [-1, 1]) {
          for (let k = 0; k < 2; k++) {
            this.particles.push({
              x: W / 2 + s * pw * 0.24,
              y: py - pw * 0.08,
              vx: (Math.random() - 0.5) * 160 * ui,
              vy: (120 + Math.random() * 380) * ui,
              life: 0.35,
              max: 0.35,
              size: (2 + Math.random() * 4) * ui,
              grow: -4 * ui,
              color: Math.random() < 0.5 ? '120,190,255' : '255,200,120',
              add: true,
            });
          }
        }
      }
    }
    const g = 900 * ui;
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.add) p.vy += g * dt * (p.vy < 0 ? 1 : 0);
      p.size = Math.max(0.5, p.size + p.grow * dt);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);
  }

  private rgbOf(c: string) {
    const m = c.match(/\d+/g);
    return m ? `${m[0]},${m[1]},${m[2]}` : '255,255,255';
  }

  // ------------------------------------------------------------ render
  private project(p: P, camX: number, camY: number, camZ: number, depth: number) {
    p.cy = p.wy - camY;
    p.cz = p.wz - camZ;
    p.cx = -camX;
    p.sc = depth / p.cz;
    p.sx = Math.round(this.W / 2 + (p.sc * p.cx * this.W) / 2);
    p.sy = Math.round(this.hz - (p.sc * p.cy * this.H) / 2);
    p.sw = Math.round((p.sc * ROAD_W * this.W) / 2);
  }

  private poly(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.lineTo(x3, y3);
    c.lineTo(x4, y4);
    c.closePath();
    c.fill();
  }

  private drawLayer(cv: HTMLCanvasElement, off: number) {
    const LW = cv.width;
    const o = ((off % LW) + LW) % LW;
    const y = this.hz + 1 - cv.height;
    for (let x = -o - LW; x < this.W + PAD; x += LW) this.ctx.drawImage(cv, Math.round(x), y);
  }

  private render() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const hz = this.hz;
    const ui = this.ui;
    const th = this.theme;
    const segs = this.segments;
    const speedPct = this.speed / MAX_SPEED;
    const depth = BASE_DEPTH * (1 - this.boostAmt * 0.1);

    ctx.save();
    if (this.shake > 0.01) ctx.translate((Math.random() - 0.5) * this.shake * 9 * ui, (Math.random() - 0.5) * this.shake * 9 * ui);

    // sky + parallax + ground base
    ctx.drawImage(this.sky, -PAD, -PAD);
    this.drawLayer(this.farL, this.offFar);
    this.drawLayer(this.nearL, this.offNear);
    ctx.fillStyle = th.fog;
    ctx.fillRect(-PAD, hz, W + PAD * 2, H - hz + PAD);

    const baseSeg = this.findSeg(this.position);
    const basePercent = pct(this.position, SEG);
    const ps = this.findSeg(this.position + PLAYER_Z);
    const playerPercent = pct(this.position + PLAYER_Z, SEG);
    const playerY = lerp(ps.p1.wy, ps.p2.wy, playerPercent);
    const L = this.trackLength;

    let maxy = H + PAD;
    let x = 0;
    let dxc = -(baseSeg.curve * basePercent);

    for (let n = 0; n < DRAW; n++) {
      const seg = segs[(baseSeg.index + n) % segs.length];
      const looped = seg.index < baseSeg.index;
      seg.fog = 1 - 1 / Math.exp((n / DRAW) * (n / DRAW) * FOG_DENSITY);
      const camZ = this.position - (looped ? L : 0);
      this.project(seg.p1, this.playerX * ROAD_W - x, playerY + CAM_H, camZ, depth);
      this.project(seg.p2, this.playerX * ROAD_W - x - dxc, playerY + CAM_H, camZ, depth);
      x += dxc;
      dxc += seg.curve;
      seg.clip = maxy;

      const p1 = seg.p1;
      const p2 = seg.p2;
      if (p1.cz <= depth || p2.sy >= p1.sy || p2.sy >= maxy) continue;

      const c = seg.alt;
      const y1 = p1.sy + 1;
      const y2 = p2.sy;
      ctx.fillStyle = th.grass[c];
      ctx.fillRect(-PAD, y2, W + PAD * 2, y1 - y2);
      const r1 = p1.sw / Math.max(6, 2 * LANES);
      const r2 = p2.sw / Math.max(6, 2 * LANES);
      this.poly(p1.sx - p1.sw - r1, y1, p1.sx - p1.sw, y1, p2.sx - p2.sw, y2, p2.sx - p2.sw - r2, y2, th.rumble[c]);
      this.poly(p1.sx + p1.sw + r1, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx + p2.sw + r2, y2, th.rumble[c]);
      this.poly(p1.sx - p1.sw, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx - p2.sw, y2, th.road[c]);
      if (seg.mark) {
        const cols = 12;
        for (let k = 0; k < cols; k++) {
          if ((k + seg.mark) % 2) continue;
          const a = k / cols;
          const b = (k + 1) / cols;
          const xa1 = lerp(p1.sx - p1.sw, p1.sx + p1.sw, a);
          const xb1 = lerp(p1.sx - p1.sw, p1.sx + p1.sw, b);
          const xa2 = lerp(p2.sx - p2.sw, p2.sx + p2.sw, a);
          const xb2 = lerp(p2.sx - p2.sw, p2.sx + p2.sw, b);
          this.poly(xa1, y1, xb1, y1, xb2, y2, xa2, y2, '#f6f6f6');
        }
      }
      if (th.edge) {
        const e1 = p1.sw * 0.025;
        const e2 = p2.sw * 0.025;
        ctx.globalAlpha = 0.9;
        this.poly(p1.sx - p1.sw, y1, p1.sx - p1.sw + e1, y1, p2.sx - p2.sw + e2, y2, p2.sx - p2.sw, y2, th.edge);
        this.poly(p1.sx + p1.sw - e1, y1, p1.sx + p1.sw, y1, p2.sx + p2.sw, y2, p2.sx + p2.sw - e2, y2, th.edge);
        ctx.globalAlpha = 1;
      }
      if (c === 0) {
        const l1 = p1.sw / Math.max(32, 8 * LANES);
        const l2 = p2.sw / Math.max(32, 8 * LANES);
        const lw1 = (p1.sw * 2) / LANES;
        const lw2 = (p2.sw * 2) / LANES;
        let lx1 = p1.sx - p1.sw + lw1;
        let lx2 = p2.sx - p2.sw + lw2;
        for (let lane = 1; lane < LANES; lane++) {
          this.poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, th.lane);
          lx1 += lw1;
          lx2 += lw2;
        }
      }
      // fog
      if (seg.fog > 0.003) {
        ctx.globalAlpha = seg.fog;
        ctx.fillStyle = th.fog;
        ctx.fillRect(-PAD, y2, W + PAD * 2, y1 - y2);
        ctx.globalAlpha = 1;
      }
      maxy = p1.sy;
    }

    // sprites back-to-front
    const pw = W * PLAYER_W;
    let playerDrawn = false;
    for (let n = DRAW - 1; n > 0; n--) {
      const seg = segs[(baseSeg.index + n) % segs.length];
      const p1 = seg.p1;
      if (p1.cz <= depth || p1.sc <= 0) continue;
      const fogA = 1 - seg.fog * 0.92;

      // rival cars
      for (const car of seg.cars) {
        const sc = lerp(seg.p1.sc, seg.p2.sc, car.percent);
        const sx = lerp(seg.p1.sx, seg.p2.sx, car.percent) + (sc * car.offset * ROAD_W * W) / 2;
        const sy = lerp(seg.p1.sy, seg.p2.sy, car.percent);
        const w = (sc * car.w * ROAD_W * W) / 2;
        if (w < 1.2) continue;
        ctx.globalAlpha = fogA;
        const clip = seg.clip;
        if (clip < sy) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, clip);
          ctx.clip();
          drawCar(ctx, sx, sy, w, car.style, { brake: car.speed < this.speed * 0.9 ? 0.6 : 0.1, time: this.time });
          ctx.restore();
        } else {
          drawCar(ctx, sx, sy, w, car.style, { brake: car.speed < this.speed * 0.9 ? 0.6 : 0.1, time: this.time });
        }
        ctx.globalAlpha = 1;
      }

      // scenery
      for (const s of seg.sprites) {
        const info = SPRITE_INFO[s.kind];
        const hpx = (info.h * p1.sc * W) / 2;
        if (hpx < 2) continue;
        const sx = p1.sx + p1.sw * s.offset;
        const sy = p1.sy;
        if (sx < -hpx * 1.6 - 40 || sx > W + hpx * 1.6 + 40) continue;
        ctx.globalAlpha = fogA;
        const dir = s.offset > 0 ? -1 : 1;
        if (seg.clip < sy) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, 0, W, seg.clip);
          ctx.clip();
          drawSprite(ctx, s.kind, sx, sy, hpx, s.v, dir, th);
          ctx.restore();
        } else {
          drawSprite(ctx, s.kind, sx, sy, hpx, s.v, dir, th);
        }
        ctx.globalAlpha = 1;
      }

      // nitro orb
      if (seg.orb && !seg.orb.taken) {
        const o = seg.orb;
        const ox = p1.sx + p1.sw * o.offset;
        const rad = p1.sw * 0.1;
        const oy = p1.sy - rad * (1.6 + Math.sin(this.time * 4 + seg.index) * 0.25);
        if (rad > 2 && oy < seg.clip + rad) {
          ctx.globalAlpha = fogA;
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, rad * 2.4);
          g.addColorStop(0, 'rgba(180,255,255,0.95)');
          g.addColorStop(0.3, 'rgba(40,220,255,0.55)');
          g.addColorStop(1, 'rgba(0,120,255,0)');
          ctx.fillStyle = g;
          ctx.fillRect(ox - rad * 2.4, oy - rad * 2.4, rad * 4.8, rad * 4.8);
          ctx.strokeStyle = 'rgba(200,255,255,0.9)';
          ctx.lineWidth = Math.max(1, rad * 0.14);
          ctx.beginPath();
          ctx.arc(ox, oy, rad, 0, 7);
          ctx.stroke();
          if (rad > 7) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(ox + rad * 0.15, oy - rad * 0.6);
            ctx.lineTo(ox - rad * 0.35, oy + rad * 0.1);
            ctx.lineTo(ox, oy + rad * 0.1);
            ctx.lineTo(ox - rad * 0.15, oy + rad * 0.6);
            ctx.lineTo(ox + rad * 0.35, oy - rad * 0.1);
            ctx.lineTo(ox, oy - rad * 0.1);
            ctx.closePath();
            ctx.fill();
          }
          ctx.globalCompositeOperation = 'source-over';
          ctx.globalAlpha = 1;
        }
      }

      // player car sits between segment n=~4 and closer scenery
      if (seg === ps) {
        this.drawPlayer(pw, speedPct);
        playerDrawn = true;
      }
    }
    if (!playerDrawn) this.drawPlayer(pw, speedPct);

    // particles
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.add) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${p.color},${(p.add ? 0.9 : 0.35) * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, 7);
      ctx.fill();
      if (p.add) ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();

    // post FX
    this.postFx(speedPct);

    if (this.state !== 'attract') this.drawHUD();
  }

  private drawPlayer(pw: number, speedPct: number) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const bounce = this.speed > 0 ? (Math.random() - 0.5) * 2.2 * speedPct * ui * (this.offroad ? 3 : 1) : 0;
    const py = this.hz + H / 2 + bounce + (this.state === 'countdown' ? Math.sin(this.time * 55) * 0.8 : 0);

    // headlight beam on night maps
    if (this.theme.stars && this.theme.id === 'neon') {
      const g = ctx.createLinearGradient(0, py - pw * 0.5, 0, this.hz + H * 0.1);
      g.addColorStop(0, 'rgba(160,240,255,0.22)');
      g.addColorStop(1, 'rgba(160,240,255,0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(W / 2 - pw * 0.32, py - pw * 0.4);
      ctx.lineTo(W / 2 + pw * 0.32, py - pw * 0.4);
      ctx.lineTo(W / 2 + W * 0.14, this.hz + H * 0.1);
      ctx.lineTo(W / 2 - W * 0.14, this.hz + H * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    drawCar(
      ctx,
      W / 2,
      py,
      pw,
      { body: this.car.body, accent: this.car.accent },
      {
        brake: this.input.brake && this.state === 'racing' ? 1 : 0,
        boost: this.boostAmt,
        steer: this.steerVis,
        time: this.time,
      },
    );
  }

  private postFx(speedPct: number) {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const strength = clamp((speedPct - 0.65) / 0.6, 0, 1) * 0.6 + this.boostAmt * 0.6;

    // zoom blur on boost
    if (this.boostAmt > 0.15) {
      const z = 10 + this.boostAmt * 26;
      ctx.globalAlpha = 0.16 * this.boostAmt;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(this.canvas, -z, -z * (H / W) - H * 0.02, W + z * 2, H + z * 2 * (H / W));
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    // speed lines
    if (strength > 0.05 && this.state !== 'countdown') {
      const n = Math.floor(10 + strength * 36);
      ctx.lineCap = 'round';
      const cx = W / 2;
      const cy = H * 0.47;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r0 = H * (0.38 + Math.random() * 0.4);
        const r1 = r0 + H * (0.08 + Math.random() * 0.3) * (0.4 + strength);
        ctx.strokeStyle = `rgba(${this.boostAmt > 0.3 ? '170,225,255' : '255,255,255'},${(0.05 + Math.random() * 0.14) * strength * 1.4})`;
        ctx.lineWidth = (0.8 + Math.random() * 1.8) * ui;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0 * 1.35, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1 * 1.35, cy + Math.sin(a) * r1);
        ctx.stroke();
      }
    }
    // boost blue tint
    if (this.boostAmt > 0.05) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(40,120,255,0)');
      g.addColorStop(1, `rgba(40,140,255,${0.32 * this.boostAmt})`);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
    // crash flash
    if (this.shake > 0.5) {
      ctx.fillStyle = `rgba(255,60,60,${(this.shake - 0.5) * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(this.vignette, 0, 0);
  }

  // ------------------------------------------------------------ HUD
  private rrect(x: number, y: number, w: number, h: number, r: number) {
    const c = this.ctx;
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  private text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', weight = 900) {
    const c = this.ctx;
    c.font = `italic ${weight} ${size}px Orbitron, "Arial Black", Impact, sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillStyle = color;
    c.fillText(s, x, y);
  }

  private drawHUD() {
    const ctx = this.ctx;
    const W = this.W;
    const H = this.H;
    const ui = this.ui;
    const th = this.theme;
    const m = 22 * ui;
    const accent = th.accent[0];

    // --- position panel
    ctx.save();
    const pw = 176 * ui;
    const ph = 92 * ui;
    const pg = ctx.createLinearGradient(m, m, m + pw, m);
    pg.addColorStop(0, 'rgba(8,6,24,0.72)');
    pg.addColorStop(1, 'rgba(8,6,24,0.25)');
    ctx.fillStyle = pg;
    this.rrect(m, m, pw, ph, 10 * ui);
    ctx.fill();
    ctx.fillStyle = accent;
    this.rrect(m, m, 5 * ui, ph, 3 * ui);
    ctx.fill();
    this.text('POSITION', m + 20 * ui, m + 24 * ui, 11 * ui, 'rgba(255,255,255,0.65)', 'left', 700);
    this.text(String(this.state === 'finished' ? this.finalRank : this.rank), m + 20 * ui, m + 74 * ui, 58 * ui, '#ffffff');
    const wRank = ctx.measureText(String(this.rank)).width;
    this.text(`/${RIVAL_COUNT + 1}`, m + 26 * ui + wRank, m + 74 * ui, 22 * ui, 'rgba(255,255,255,0.6)');
    ctx.restore();

    // --- time panel (top right)
    const tw = 224 * ui;
    const tx = W - m - tw;
    const tg = ctx.createLinearGradient(tx, m, tx + tw, m);
    tg.addColorStop(0, 'rgba(8,6,24,0.25)');
    tg.addColorStop(1, 'rgba(8,6,24,0.72)');
    ctx.fillStyle = tg;
    this.rrect(tx, m, tw, ph, 10 * ui);
    ctx.fill();
    ctx.fillStyle = th.accent[1];
    this.rrect(tx + tw - 5 * ui, m, 5 * ui, ph, 3 * ui);
    ctx.fill();
    this.text('TIME', tx + tw - 20 * ui, m + 24 * ui, 11 * ui, 'rgba(255,255,255,0.65)', 'right', 700);
    this.text(fmtTime(this.raceTime), tx + tw - 20 * ui, m + 54 * ui, 27 * ui, '#ffffff', 'right');
    const best = this.lapTimes.length ? Math.min(...this.lapTimes) : NaN;
    this.text(`BEST LAP ${fmtTime(best)}`, tx + tw - 20 * ui, m + 78 * ui, 11.5 * ui, '#ffd166', 'right', 700);

    // --- lap + progress (top center)
    const curLap = clamp(Math.floor((this.dist - LINE_DIST) / this.trackLength) + 1, 1, this.laps);
    const bw = Math.min(340 * ui, W * 0.3);
    const bx = W / 2 - bw / 2;
    const by = m + 12 * ui;
    this.text(`LAP ${curLap}/${this.laps}`, W / 2, m + 12 * ui, 24 * ui, '#ffffff', 'center');
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    this.rrect(bx - 6 * ui, by + 12 * ui, bw + 12 * ui, 16 * ui, 8 * ui);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, by + 19.5 * ui, bw, 2 * ui);
    const total = LINE_DIST + this.laps * this.trackLength;
    for (const c of this.rivals) {
      const p = clamp(c.dist / total, 0, 1);
      ctx.fillStyle = c.style.body;
      ctx.beginPath();
      ctx.arc(bx + p * bw, by + 20.5 * ui, 3.2 * ui, 0, 7);
      ctx.fill();
    }
    const pp = clamp(this.dist / total, 0, 1);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.4 * ui;
    ctx.beginPath();
    ctx.arc(bx + pp * bw, by + 20.5 * ui, 5.5 * ui, 0, 7);
    ctx.fill();
    ctx.stroke();

    // --- speedometer
    const R = 104 * ui;
    const cx = W - m - R - 14 * ui;
    const cy = H - m - R - 4 * ui;
    const a0 = Math.PI * 0.75;
    const sweep = Math.PI * 1.5;
    const kmh = (this.speed / MAX_SPEED) * 300;
    const frac = clamp(kmh / 430, 0, 1);
    ctx.fillStyle = 'rgba(6,4,20,0.62)';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 12 * ui, 0, 7);
    ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 11 * ui;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 6 * ui, a0, a0 + sweep);
    ctx.stroke();
    const sgd = ctx.createLinearGradient(cx - R, cy + R, cx + R, cy - R);
    sgd.addColorStop(0, '#00f0ff');
    sgd.addColorStop(0.55, '#ff2e93');
    sgd.addColorStop(1, '#ffd166');
    ctx.strokeStyle = this.boostAmt > 0.3 ? '#7df9ff' : sgd;
    ctx.lineWidth = 11 * ui;
    if (frac > 0.005) {
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6 * ui, a0, a0 + sweep * frac);
      ctx.stroke();
    }
    ctx.lineWidth = 1.6 * ui;
    for (let i = 0; i <= 43; i++) {
      const a = a0 + (sweep * i) / 43;
      const big = i % 5 === 0;
      const r0 = R - 24 * ui;
      const r1 = r0 - (big ? 9 : 5) * ui;
      ctx.strokeStyle = i / 43 <= frac ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
    this.text(String(Math.round(kmh)), cx, cy + 14 * ui, 46 * ui, '#ffffff', 'center');
    this.text('KM/H', cx, cy + 36 * ui, 12 * ui, 'rgba(255,255,255,0.65)', 'center', 700);
    this.text(`GEAR ${this.speed < 50 ? 'N' : this.gearDisp}`, cx, cy - 34 * ui, 13 * ui, th.accent[1], 'center', 700);

    // --- nitro bar
    const nx = m;
    const nw = Math.min(320 * ui, W * 0.34);
    const ny = H - m - 26 * ui;
    const nf = clamp(this.nitro / this.car.nitro, 0, 1);
    ctx.fillStyle = 'rgba(6,4,20,0.62)';
    this.rrect(nx - 8 * ui, ny - 34 * ui, nw + 16 * ui, 66 * ui, 10 * ui);
    ctx.fill();
    this.text('NITRO', nx, ny - 12 * ui, 13 * ui, this.boostAmt > 0.3 ? '#7df9ff' : 'rgba(255,255,255,0.8)', 'left', 700);
    this.text(`${Math.round(nf * 100)}%`, nx + nw, ny - 12 * ui, 13 * ui, 'rgba(255,255,255,0.8)', 'right', 700);
    const segN = 26;
    const sgw = nw / segN;
    for (let i = 0; i < segN; i++) {
      const lit = (i + 0.5) / segN <= nf;
      const x0 = nx + i * sgw;
      ctx.fillStyle = lit ? (this.boostAmt > 0.3 ? '#bff6ff' : `hsl(${190 - (i / segN) * 40},100%,${55 + (i / segN) * 10}%)`) : 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.moveTo(x0 + 4 * ui, ny);
      ctx.lineTo(x0 + sgw, ny);
      ctx.lineTo(x0 + sgw - 4 * ui, ny + 20 * ui);
      ctx.lineTo(x0, ny + 20 * ui);
      ctx.closePath();
      ctx.fill();
    }
    if (nf > 0.02 && !this.boosting && this.state === 'racing') {
      this.text('SHIFT / SPACE', nx + nw / 2, ny + 38 * ui, 10 * ui, 'rgba(255,255,255,0.4)', 'center', 700);
    }

    // --- toasts
    const last = this.toasts[this.toasts.length - 1];
    if (last) {
      const k = last.t / last.dur;
      const a = k < 0.12 ? k / 0.12 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const sc = 1 + (k < 0.12 ? (1 - k / 0.12) * 0.5 : 0);
      ctx.save();
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.translate(W / 2, H * 0.27);
      ctx.scale(sc, sc);
      ctx.shadowColor = last.color;
      ctx.shadowBlur = 24 * ui;
      this.text(last.text, 0, 0, 46 * ui, last.color, 'center');
      ctx.restore();
    }

    // --- countdown
    if (this.state === 'countdown') {
      const n = Math.floor(this.cdTime);
      const f = this.cdTime - n;
      const label = String(Math.min(3, 3 - n));
      const col = n === 0 ? '#ff4d5e' : n === 1 ? '#ffb02e' : n === 2 ? '#ffe14d' : '#5dff9a';
      const sc = 1 + (1 - f) * 0.6;
      ctx.save();
      ctx.translate(W / 2, H * 0.34);
      ctx.scale(sc, sc);
      ctx.globalAlpha = clamp(1.2 - f * 0.9, 0, 1);
      ctx.shadowColor = col;
      ctx.shadowBlur = 40 * ui;
      this.text(label, 0, 0, 130 * ui, col, 'center');
      ctx.restore();
    }
  }
}
