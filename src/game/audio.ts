const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS: { root: number; arp: number[] }[] = [
  { root: 57, arp: [0, 3, 7, 12] },
  { root: 53, arp: [0, 4, 7, 12] },
  { root: 48, arp: [0, 4, 7, 12] },
  { root: 55, arp: [0, 4, 7, 11] },
];

export class GameAudio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private engGain!: GainNode;
  private engFilter!: BiquadFilterNode;
  private o1!: OscillatorNode;
  private o2!: OscillatorNode;
  private o3!: OscillatorNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private bpm = 112;
  private transpose = 0;
  muted = false;
  musicOn = true;

  init() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = this.musicOn ? 0.22 : 0;
    this.music.connect(this.master);

    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // engine
    this.engFilter = ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 600;
    this.engFilter.Q.value = 3;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.o1 = ctx.createOscillator();
    this.o1.type = 'sawtooth';
    this.o2 = ctx.createOscillator();
    this.o2.type = 'square';
    this.o3 = ctx.createOscillator();
    this.o3.type = 'sawtooth';
    const g1 = ctx.createGain();
    g1.gain.value = 0.5;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    const g3 = ctx.createGain();
    g3.gain.value = 0.18;
    this.o1.connect(g1).connect(this.engFilter);
    this.o2.connect(g2).connect(this.engFilter);
    this.o3.connect(g3).connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.sfx);
    this.o1.start();
    this.o2.start();
    this.o3.start();

    // wind
    const wn = ctx.createBufferSource();
    wn.buffer = this.noise;
    wn.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 800;
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    wn.connect(this.windFilter).connect(this.windGain).connect(this.sfx);
    wn.start();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }

  setPaused(p: boolean) {
    if (!this.ctx) return;
    if (p) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  setEngine(speedPct: number, throttle: number, boost: number, offroad: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const gears = 6;
    const sp = Math.min(speedPct / 1.35, 1) * gears;
    const g = Math.min(gears - 1, Math.floor(sp));
    const frac = sp - g;
    const rpm = speedPct < 0.02 ? 0.12 + throttle * 0.25 : 0.28 + frac * 0.72;
    const f = 34 + rpm * 120 + g * 3;
    this.o1.frequency.setTargetAtTime(f, t, 0.03);
    this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    this.o3.frequency.setTargetAtTime(f * 2.01, t, 0.03);
    this.engFilter.frequency.setTargetAtTime(350 + rpm * 1700 + boost * 900 + throttle * 400, t, 0.05);
    this.engGain.gain.setTargetAtTime(0.1 + throttle * 0.07 + boost * 0.05, t, 0.05);
    this.windGain.gain.setTargetAtTime(Math.min(0.5, speedPct * 0.3 + boost * 0.15 + (offroad ? 0.1 : 0)), t, 0.1);
    this.windFilter.frequency.setTargetAtTime(500 + speedPct * 1800, t, 0.1);
  }

  silenceEngine() {
    if (!this.ctx) return;
    this.engGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
  }

  private burst(dur: number, freq: number, q: number, gain: number, type: BiquadFilterType, sweepTo?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, when = 0, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  crash(power = 1) {
    this.burst(0.5, 1800, 0.8, 0.9 * power, 'lowpass', 120);
    this.tone(140, 0.35, 'sine', 0.8 * power, 0, 40);
  }
  scrape() {
    this.burst(0.18, 3000, 2, 0.3, 'bandpass', 1500);
  }
  boost() {
    this.burst(1.0, 400, 1.2, 0.5, 'bandpass', 5000);
    this.tone(180, 0.7, 'sawtooth', 0.12, 0, 700);
  }
  pickup() {
    this.tone(660, 0.12, 'triangle', 0.25);
    this.tone(990, 0.2, 'triangle', 0.25, 0.08);
  }
  beep(go = false) {
    this.tone(go ? 880 : 440, go ? 0.7 : 0.18, 'square', 0.2);
  }
  lap() {
    this.tone(784, 0.15, 'triangle', 0.3);
    this.tone(1046, 0.15, 'triangle', 0.3, 0.12);
    this.tone(1318, 0.35, 'triangle', 0.3, 0.24);
  }
  finish() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.3, i * 0.13));
  }

  // ---- music ----
  startMusic(bpm: number, transpose: number) {
    if (!this.ctx) return;
    this.stopMusic();
    this.bpm = bpm;
    this.transpose = transpose;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 60);
  }

  stopMusic() {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  setMusic(on: boolean) {
    this.musicOn = on;
    if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.1);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const stepDur = 60 / this.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextTime);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  private mnote(freq: number, t: number, dur: number, type: OscillatorType, gain: number, cutoff: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(cutoff, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private playStep(step: number, t: number) {
    const ctx = this.ctx!;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % 4;
    const ch = CHORDS[bar];
    const root = ch.root + this.transpose;
    const stepDur = 60 / this.bpm / 4;

    // bass (offbeat 8ths pump)
    if (s16 % 2 === 0) {
      const oct = s16 % 4 === 2 ? 12 : 0;
      this.mnote(mtof(root - 24 + oct), t, stepDur * 1.8, 'sawtooth', 0.55, 900);
    }
    // arp
    const a = ch.arp[[0, 1, 2, 3, 2, 1, 2, 3][s16 % 8]];
    this.mnote(mtof(root + 12 + a), t, stepDur * 1.5, 'square', 0.16, 2600);
    // pad on bar start
    if (s16 === 0) {
      for (const i of ch.arp.slice(0, 3)) this.mnote(mtof(root + i), t, stepDur * 15, 'sawtooth', 0.09, 1200);
    }
    // lead melody every other bar
    if (step % 32 >= 16 && s16 % 4 === 0) {
      const mel = [12, 14, 15, 19, 17, 15, 14, 12][(s16 / 4 + bar * 2) % 8 | 0];
      this.mnote(mtof(root + 12 + mel), t, stepDur * 3, 'triangle', 0.28, 3500);
    }
    // kick
    if (s16 % 4 === 0) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(1.0, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g).connect(this.music);
      o.start(t);
      o.stop(t + 0.25);
    }
    // snare
    if (s16 === 4 || s16 === 12) this.noiseHit(t, 0.16, 1800, 0.55, 'highpass');
    // hats
    if (s16 % 2 === 0) this.noiseHit(t, 0.04, 7000, s16 % 4 === 2 ? 0.35 : 0.18, 'highpass');
  }

  private noiseHit(t: number, dur: number, freq: number, gain: number, type: BiquadFilterType) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.music);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }
}
