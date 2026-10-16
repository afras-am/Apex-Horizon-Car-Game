import { useEffect, useRef } from 'react';
import { drawCar } from '../game/carDraw';
import type { CarSpec } from '../game/themes';

export default function CarPreview({ car, active }: { car: CarSpec; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = 280;
    const H = 150;
    cv.width = W * dpr;
    cv.height = H * dpr;
    let raf = 0;
    const draw = (ts: number) => {
      const t = ts / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      // floor glow
      const g = ctx.createRadialGradient(W / 2, H - 28, 4, W / 2, H - 28, 130);
      g.addColorStop(0, car.body + 'aa');
      g.addColorStop(0.5, car.body + '30');
      g.addColorStop(1, car.body + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(20, H - 26, W - 40, 1);
      drawCar(ctx, W / 2, H - 28 + (active ? Math.sin(t * 40) * 0.4 : 0), 176, car, {
        boost: active ? 0.55 + Math.sin(t * 5) * 0.2 : 0,
        brake: 0,
        time: t,
      });
      if (active) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [car, active]);

  return <canvas ref={ref} style={{ width: 280, height: 150 }} className="mx-auto max-w-full" />;
}
