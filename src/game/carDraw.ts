export interface CarStyle {
  body: string;
  accent: string;
}

export interface CarOpts {
  brake?: number; // 0..1
  boost?: number; // 0..1
  steer?: number; // -1..1
  time?: number;
}

export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  if (amt < 0) {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  } else {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draws a sports car seen from behind. (cx, by) = bottom-centre of the car, w = pixel width.
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  by: number,
  w: number,
  style: CarStyle,
  opts: CarOpts = {},
) {
  const brake = opts.brake ?? 0;
  const boost = opts.boost ?? 0;
  const steer = opts.steer ?? 0;
  const t = opts.time ?? 0;

  if (w < 9) {
    ctx.fillStyle = style.body;
    ctx.fillRect(cx - w / 2, by - w * 0.45, w, w * 0.4);
    ctx.fillStyle = '#ff1f3a';
    ctx.fillRect(cx - w / 2, by - w * 0.28, w * 0.22, Math.max(1, w * 0.1));
    ctx.fillRect(cx + w / 2 - w * 0.22, by - w * 0.28, w * 0.22, Math.max(1, w * 0.1));
    return;
  }

  const u = w / 100;
  const detail = w > 38;
  ctx.save();
  ctx.translate(cx, by);
  ctx.scale(u, u);
  if (steer) ctx.transform(1, 0, steer * 0.07, 1, 0, 0);

  // ground shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(0, -1, 60, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // wheels
  ctx.fillStyle = '#08080c';
  for (const s of [-1, 1]) {
    rr(ctx, s * 46 - 6.5, -22, 13, 22, 3.5);
    ctx.fill();
    if (detail) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(s * 46 - 5, -20, 2, 18);
      ctx.fillStyle = '#08080c';
    }
  }

  // lower diffuser
  const dg = ctx.createLinearGradient(0, -16, 0, 0);
  dg.addColorStop(0, '#1d1d26');
  dg.addColorStop(1, '#050507');
  ctx.fillStyle = dg;
  rr(ctx, -44, -16, 88, 14, 4);
  ctx.fill();
  if (detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = -3; i <= 3; i++) ctx.fillRect(i * 9 - 1, -13, 2, 9);
    // exhausts
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#9aa0ad';
      ctx.beginPath();
      ctx.arc(s * 24, -8, 5.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#040405';
      ctx.beginPath();
      ctx.arc(s * 24, -8, 3.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // main body
  const bg = ctx.createLinearGradient(0, -34, 0, -8);
  bg.addColorStop(0, shade(style.body, 0.35));
  bg.addColorStop(0.35, style.body);
  bg.addColorStop(1, shade(style.body, -0.55));
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-50, -12);
  ctx.quadraticCurveTo(-52, -26, -44, -32);
  ctx.lineTo(44, -32);
  ctx.quadraticCurveTo(52, -26, 50, -12);
  ctx.quadraticCurveTo(0, -6, -50, -12);
  ctx.closePath();
  ctx.fill();

  // cabin
  const cg = ctx.createLinearGradient(0, -54, 0, -30);
  cg.addColorStop(0, shade(style.body, 0.15));
  cg.addColorStop(1, shade(style.body, -0.35));
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(-38, -31);
  ctx.lineTo(-29, -50);
  ctx.quadraticCurveTo(-27, -54, -22, -54);
  ctx.lineTo(22, -54);
  ctx.quadraticCurveTo(27, -54, 29, -50);
  ctx.lineTo(38, -31);
  ctx.closePath();
  ctx.fill();

  // rear glass
  const gg = ctx.createLinearGradient(0, -50, 0, -33);
  gg.addColorStop(0, '#2c4a68');
  gg.addColorStop(1, '#070d18');
  ctx.fillStyle = gg;
  ctx.beginPath();
  ctx.moveTo(-33, -33);
  ctx.lineTo(-26, -48.5);
  ctx.lineTo(26, -48.5);
  ctx.lineTo(33, -33);
  ctx.closePath();
  ctx.fill();
  if (detail) {
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.moveTo(-20, -48.5);
    ctx.lineTo(-8, -48.5);
    ctx.lineTo(-18, -33);
    ctx.lineTo(-29, -33);
    ctx.closePath();
    ctx.fill();
  }

  // racing stripes
  if (detail) {
    ctx.fillStyle = style.accent;
    ctx.globalAlpha = 0.92;
    ctx.fillRect(-7, -32, 4, 18);
    ctx.fillRect(3, -32, 4, 18);
    ctx.fillRect(-7, -54, 4, 6);
    ctx.fillRect(3, -54, 4, 6);
    ctx.globalAlpha = 1;
  }

  // body highlight
  if (detail) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-43, -31.5);
    ctx.lineTo(43, -31.5);
    ctx.stroke();
  }

  // spoiler
  const sg = ctx.createLinearGradient(0, -42, 0, -37);
  sg.addColorStop(0, shade(style.accent, 0.1));
  sg.addColorStop(1, shade(style.accent, -0.5));
  ctx.fillStyle = '#101018';
  ctx.fillRect(-22, -38, 4, 8);
  ctx.fillRect(18, -38, 4, 8);
  ctx.fillStyle = sg;
  rr(ctx, -50, -43, 100, 5.5, 2);
  ctx.fill();
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(-51, -47, 3, 14);
  ctx.fillRect(48, -47, 3, 14);

  // number plate
  if (detail) {
    ctx.fillStyle = '#f5f5ee';
    rr(ctx, -9, -22, 18, 8, 1.5);
    ctx.fill();
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(-7, -19.5, 14, 1.4);
    ctx.fillRect(-7, -17, 9, 1.2);
  }

  // tail lights
  const lit = Math.min(1, 0.65 + brake * 0.35 + boost * 0.2);
  ctx.fillStyle = `rgba(255,24,52,${lit})`;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 47, -30);
    ctx.lineTo(s * 27, -29);
    ctx.lineTo(s * 25, -22.5);
    ctx.lineTo(s * 46, -21);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(-27, -26.5, 54, 2.2);
  ctx.fillStyle = `rgba(255,190,190,${0.5 + brake * 0.5})`;
  for (const s of [-1, 1]) ctx.fillRect(s > 0 ? 30 : -45, -27, 15, 1.6);

  // light bloom
  ctx.globalCompositeOperation = 'lighter';
  const gr = 22 + brake * 14 + boost * 8;
  for (const s of [-1, 1]) {
    const rg = ctx.createRadialGradient(s * 36, -26, 1, s * 36, -26, gr);
    rg.addColorStop(0, `rgba(255,40,60,${0.55 + brake * 0.35})`);
    rg.addColorStop(1, 'rgba(255,0,30,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(s * 36 - gr, -26 - gr, gr * 2, gr * 2);
  }

  // nitro flames
  if (boost > 0.02) {
    for (const s of [-1, 1]) {
      const fl = 10 + boost * 16 + Math.sin(t * 60 + s) * 4 + Math.random() * 4;
      const fg = ctx.createRadialGradient(s * 24, -8, 0, s * 24, -8, fl);
      fg.addColorStop(0, `rgba(210,240,255,${0.95 * boost})`);
      fg.addColorStop(0.35, `rgba(70,160,255,${0.8 * boost})`);
      fg.addColorStop(1, 'rgba(40,60,255,0)');
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.arc(s * 24, -8, fl, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
