import type { SpriteKind, Theme } from './themes';

export const SPRITE_INFO: Record<SpriteKind, { h: number; solid: number }> = {
  palm: { h: 4200, solid: 0.1 },
  pine: { h: 3800, solid: 0.12 },
  cactus: { h: 2600, solid: 0.1 },
  rock: { h: 1100, solid: 0.22 },
  bush: { h: 800, solid: 0 },
  billboard: { h: 3800, solid: 0.5 },
  lamp: { h: 3600, solid: 0.05 },
  tower: { h: 9000, solid: 0.7 },
  neonSign: { h: 3000, solid: 0.1 },
  gate: { h: 3000, solid: 0 },
};

const BRANDS = ['APEX', 'NITRO', 'TURBO', 'VELOCITY', 'DRIFT', 'OCTANE', 'HORIZON', 'REDLINE'];

function hash(a: number, b: number, c: number) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Draws a sprite with its base-centre at (x, y), `h` pixels tall. Internally 100 units tall. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  kind: SpriteKind,
  x: number,
  y: number,
  h: number,
  v: number,
  dir: number,
  th: Theme,
) {
  if (h < 2) return;
  ctx.save();
  ctx.translate(x, y);
  const s = h / 100;
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const small = h < 28;

  switch (kind) {
    case 'palm': {
      const lean = dir * (6 + v * 9);
      ctx.strokeStyle = th.trunk;
      ctx.lineWidth = 3.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(lean * 0.2, -45, lean, -84);
      ctx.stroke();
      if (!small) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-0.8, 0);
        ctx.quadraticCurveTo(lean * 0.2 - 0.8, -45, lean - 0.8, -84);
        ctx.stroke();
      }
      const n = small ? 5 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + v * 3;
        const L = 26 + (i % 2) * 6;
        const ex = lean + Math.cos(a) * L;
        const ey = -84 + Math.sin(a) * L * 0.35 + L * 0.55;
        const cx2 = lean + Math.cos(a) * L * 0.55;
        const cy2 = -84 - 10 + Math.sin(a) * 4;
        ctx.strokeStyle = th.foliage[0];
        ctx.lineWidth = 4.2;
        ctx.beginPath();
        ctx.moveTo(lean, -84);
        ctx.quadraticCurveTo(cx2, cy2, ex, ey);
        ctx.stroke();
        if (!small) {
          ctx.strokeStyle = th.foliage[1];
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(lean, -85);
          ctx.quadraticCurveTo(cx2, cy2 - 1.5, ex, ey - 1.2);
          ctx.stroke();
        }
      }
      if (!small) {
        ctx.fillStyle = '#4a2c14';
        ctx.beginPath();
        ctx.arc(lean - 2, -82, 2, 0, 7);
        ctx.arc(lean + 2.5, -81.5, 2, 0, 7);
        ctx.fill();
      }
      break;
    }
    case 'pine': {
      ctx.fillStyle = th.trunk;
      ctx.fillRect(-2.5, -14, 5, 14);
      for (let i = 0; i < 3; i++) {
        const by = -10 - i * 24;
        const bw = 26 - i * 6;
        ctx.fillStyle = th.foliage[0];
        ctx.beginPath();
        ctx.moveTo(-bw, by);
        ctx.lineTo(0, by - 40);
        ctx.lineTo(bw, by);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = th.foliage[1];
        ctx.beginPath();
        ctx.moveTo(0, by - 40);
        ctx.lineTo(bw, by);
        ctx.lineTo(bw * 0.2, by);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case 'cactus': {
      ctx.strokeStyle = th.foliage[0];
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -88);
      ctx.moveTo(0, -34);
      ctx.lineTo(-20, -34);
      ctx.lineTo(-20, -62);
      ctx.moveTo(0, -50);
      ctx.lineTo(22, -50);
      ctx.lineTo(22, -76);
      ctx.stroke();
      if (!small) {
        ctx.strokeStyle = th.foliage[1];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-2, -2);
        ctx.lineTo(-2, -86);
        ctx.moveTo(-20, -36);
        ctx.lineTo(-20, -60);
        ctx.moveTo(22, -52);
        ctx.lineTo(22, -74);
        ctx.stroke();
      }
      break;
    }
    case 'rock': {
      ctx.fillStyle = th.rock[0];
      ctx.beginPath();
      ctx.moveTo(-50, 0);
      ctx.lineTo(-44, -26);
      ctx.lineTo(-20, -48);
      ctx.lineTo(12, -52);
      ctx.lineTo(40, -30);
      ctx.lineTo(50, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = th.rock[1];
      ctx.beginPath();
      ctx.moveTo(-20, -48);
      ctx.lineTo(12, -52);
      ctx.lineTo(40, -30);
      ctx.lineTo(8, -22);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'bush': {
      const cs: [number, number, number][] = [
        [-26, -18, 22],
        [0, -28, 28],
        [28, -16, 20],
      ];
      for (const [cx, cy, r] of cs) {
        ctx.fillStyle = th.foliage[0];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 7);
        ctx.fill();
      }
      if (!small) {
        for (const [cx, cy, r] of cs) {
          ctx.fillStyle = th.foliage[1];
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.62, 0, 7);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      break;
    }
    case 'billboard': {
      ctx.fillStyle = '#16161e';
      ctx.fillRect(-36, -52, 4, 52);
      ctx.fillRect(32, -52, 4, 52);
      const pg = ctx.createLinearGradient(0, -100, 0, -46);
      const ca = th.accent[Math.floor(v * 2) % 2];
      const cb = th.accent[(Math.floor(v * 2) + 1) % 2];
      pg.addColorStop(0, ca);
      pg.addColorStop(1, cb);
      ctx.fillStyle = '#0c0c12';
      ctx.fillRect(-68, -102, 136, 58);
      ctx.fillStyle = pg;
      ctx.fillRect(-64, -98, 128, 50);
      if (!small) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.moveTo(-64, -48);
        ctx.lineTo(-30, -98);
        ctx.lineTo(-10, -98);
        ctx.lineTo(-44, -48);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '900 26px Orbitron, Impact, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = h > 90 ? 3 : 0;
        ctx.fillText(BRANDS[Math.floor(v * 97) % BRANDS.length], 4, -72);
        ctx.shadowBlur = 0;
      }
      break;
    }
    case 'lamp': {
      ctx.strokeStyle = '#1b1b26';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -96);
      ctx.quadraticCurveTo(0, -102, dir * 8, -102);
      ctx.lineTo(dir * 20, -101);
      ctx.stroke();
      ctx.fillStyle = th.lamp;
      ctx.beginPath();
      ctx.ellipse(dir * 21, -100, 6, 2.4, 0, 0, 7);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      const lg = ctx.createRadialGradient(dir * 21, -99, 0, dir * 21, -99, 40);
      lg.addColorStop(0, th.lamp);
      lg.addColorStop(0.15, th.lamp + '99');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = lg;
      ctx.fillRect(dir * 21 - 40, -139, 80, 80);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'tower': {
      const g = ctx.createLinearGradient(-26, 0, 26, 0);
      g.addColorStop(0, '#120a2c');
      g.addColorStop(0.5, '#1d1245');
      g.addColorStop(1, '#0a0620');
      ctx.fillStyle = g;
      ctx.fillRect(-26, -100, 52, 100);
      if (h > 70) {
        const rows = h > 300 ? 22 : 12;
        const cols = 5;
        const ch = 100 / rows;
        for (let r = 1; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const hv = hash(v * 100, r, c);
            if (hv > 0.55) {
              ctx.fillStyle = hv > 0.85 ? th.accent[1] : hv > 0.7 ? th.accent[0] : '#ffe9a8';
              ctx.globalAlpha = 0.85;
              ctx.fillRect(-23 + c * 9.6, -100 + r * ch + 0.6, 6, ch - 1.8);
            }
          }
        }
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = th.accent[Math.floor(v * 2) % 2];
      ctx.lineWidth = 1.6;
      ctx.strokeRect(-26, -100, 52, 100);
      ctx.fillStyle = '#ff2040';
      ctx.fillRect(-1, -108, 2, 8);
      break;
    }
    case 'neonSign': {
      ctx.strokeStyle = '#1b1b2a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -48);
      ctx.stroke();
      const col0 = th.accent[0];
      const col1 = th.accent[1];
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = col0;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.arc(0, -72, 22, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -72, 22, 0, 7);
      ctx.stroke();
      ctx.strokeStyle = col1;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, -66);
      ctx.lineTo(0, -82);
      ctx.lineTo(10, -66);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
    case 'gate': {
      const hr = 67; // half-road width in sprite units
      const px = hr * 1.2;
      ctx.fillStyle = '#14141c';
      ctx.fillRect(-px - 4, -100, 8, 100);
      ctx.fillRect(px - 4, -100, 8, 100);
      ctx.fillStyle = th.accent[0];
      ctx.fillRect(-px - 4, -100, 2, 100);
      ctx.fillRect(px + 2, -100, 2, 100);
      ctx.fillStyle = '#101018';
      ctx.fillRect(-px - 6, -100, px * 2 + 12, 20);
      const sq = 5;
      const n = Math.floor((px * 2) / sq);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < n; c++) {
          ctx.fillStyle = (r + c) % 2 ? '#ffffff' : '#111';
          ctx.fillRect(-px + c * sq, -100 + r * sq, sq, sq);
        }
      }
      if (!small) {
        ctx.fillStyle = '#fff';
        ctx.font = '900 8px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('START  /  FINISH', 0, -85);
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = th.accent[0];
      ctx.globalAlpha = 0.5;
      ctx.fillRect(-px - 6, -80, px * 2 + 12, 1.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      break;
    }
  }
  ctx.restore();
}
