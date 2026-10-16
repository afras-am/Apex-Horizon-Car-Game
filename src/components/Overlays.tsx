import { useRef } from 'react';
import { fmtTime } from '../game/engine';
import type { RaceEngine, RaceResult } from '../game/engine';
import { THEMES } from '../game/themes';

const ordinal = (n: number) => {
  const s = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

export function PauseOverlay({ onResume, onRestart, onQuit }: { onResume: () => void; onRestart: () => void; onQuit: () => void }) {
  const btn = 'font-display w-full rounded-lg border border-white/25 bg-white/5 py-3 text-sm font-bold tracking-widest text-white transition hover:bg-white/15';
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="anim-in w-[min(92vw,360px)] space-y-3 rounded-2xl border border-white/15 bg-[#0b0618]/90 p-6 shadow-2xl">
        <h2 className="font-display mb-4 text-center text-3xl font-black text-white italic">PAUSED</h2>
        <button onClick={onResume} className="font-display w-full rounded-lg bg-gradient-to-r from-pink-500 to-violet-600 py-3 text-sm font-black tracking-widest text-white">
          RESUME
        </button>
        <button onClick={onRestart} className={btn}>RESTART RACE</button>
        <button onClick={onQuit} className={btn}>QUIT TO MENU</button>
      </div>
    </div>
  );
}

export function ResultOverlay({
  result,
  record,
  onAgain,
  onMenu,
}: {
  result: RaceResult;
  record: boolean;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const win = result.position === 1;
  const podium = result.position <= 3;
  const theme = THEMES.find((t) => t.id === result.themeId);
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/65 p-4 backdrop-blur-sm">
      <div className="anim-in w-[min(94vw,520px)] rounded-2xl border border-white/15 bg-[#0b0618]/92 p-6 shadow-2xl md:p-8">
        <div className="font-display text-center text-[11px] font-bold tracking-[0.45em] text-cyan-300">
          {theme?.name.toUpperCase()} · RACE COMPLETE
        </div>
        <div
          className="font-display mt-2 text-center text-7xl leading-none font-black italic md:text-8xl"
          style={{
            background: win ? 'linear-gradient(180deg,#fff7c2,#ffc400,#ff7a00)' : podium ? 'linear-gradient(180deg,#fff,#cfd8e8,#7f8ca6)' : 'linear-gradient(180deg,#fff,#ff9ac8,#7a3cff)',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 0 22px rgba(255,200,80,0.35))',
          }}
        >
          {ordinal(result.position)}
        </div>
        <div className="mt-1 text-center text-lg font-semibold text-white/70">
          {win ? 'VICTORY! Flawless driving.' : podium ? 'Podium finish!' : `Out of ${result.racers} racers`}
        </div>

        {record && (
          <div className="font-display mx-auto mt-3 w-fit rounded-full bg-amber-400 px-4 py-1 text-xs font-black text-black">★ NEW RECORD ★</div>
        )}

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          {[
            ['TOTAL', fmtTime(result.total)],
            ['BEST LAP', fmtTime(result.bestLap)],
            ['TOP SPEED', `${result.topSpeed} km/h`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-white/5 p-2.5">
              <div className="text-[10px] font-bold tracking-widest text-white/50">{k}</div>
              <div className="font-display mt-1 text-sm font-black text-white">{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          {result.laps.map((l, i) => (
            <div key={i} className="flex justify-between rounded bg-white/5 px-3 py-1.5 text-sm text-white/80">
              <span className="font-semibold">Lap {i + 1}</span>
              <span className={`font-display text-xs font-bold ${l === result.bestLap ? 'text-amber-300' : ''}`}>{fmtTime(l)}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onMenu} className="font-display rounded-lg border border-white/25 bg-white/5 py-3 text-sm font-bold tracking-widest text-white hover:bg-white/15">
            MENU
          </button>
          <button onClick={onAgain} className="font-display rounded-lg bg-gradient-to-r from-pink-500 to-violet-600 py-3 text-sm font-black tracking-widest text-white">
            RACE AGAIN
          </button>
        </div>
      </div>
    </div>
  );
}

export function TouchControls({ engine }: { engine: RaceEngine | null }) {
  const set = (k: 'left' | 'right' | 'gas' | 'brake' | 'boost', v: boolean) => {
    if (engine) engine.input[k] = v;
  };

  const mk = (k: 'left' | 'right' | 'gas' | 'brake' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      set(k, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      set(k, false);
    },
    onPointerCancel: () => set(k, false),
    onPointerLeave: () => {
      // Keep the control active while the pointer is captured.
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const base =
    'font-display flex touch-none select-none items-center justify-center rounded-2xl border border-white/30 bg-white/10 font-black text-white shadow-lg backdrop-blur active:scale-95 active:bg-white/30';

  return (
    <div className="mobile-controls pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(14px,env(safe-area-inset-bottom))]">
      <div className="flex items-end justify-between">
        {/* Steering */}
        <div className="pointer-events-auto flex gap-2 sm:gap-3">
          <button
            type="button"
            {...mk('left')}
            className={`${base} h-16 w-16 text-2xl sm:h-20 sm:w-20 sm:text-3xl`}
            aria-label="Steer left"
          >
            ◀
          </button>
          <button
            type="button"
            {...mk('right')}
            className={`${base} h-16 w-16 text-2xl sm:h-20 sm:w-20 sm:text-3xl`}
            aria-label="Steer right"
          >
            ▶
          </button>
        </div>

        {/* Driving controls */}
        <div className="pointer-events-auto flex items-end gap-2 sm:gap-3">
          <button
            type="button"
            {...mk('brake')}
            className={`${base} h-12 w-16 text-[10px] sm:h-14 sm:w-20 sm:text-xs`}
            aria-label="Brake"
          >
            BRAKE
          </button>
          <button
            type="button"
            {...mk('gas')}
            className={`${base} h-20 w-20 border-green-300/70 bg-green-400/20 text-xs sm:h-24 sm:w-24`}
            aria-label="Accelerate"
          >
            GAS
          </button>
          <button
            type="button"
            {...mk('boost')}
            className={`${base} h-16 w-16 border-cyan-300/70 bg-cyan-400/20 text-[10px] sm:h-20 sm:w-20 sm:text-xs`}
            aria-label="Nitro"
          >
            NITRO
          </button>
        </div>
      </div>
    </div>
  );
}
