import { CARS, THEMES } from '../game/themes';
import { fmtTime } from '../game/engine';
import CarPreview from './CarPreview';

interface Props {
  themeIdx: number;
  carIdx: number;
  laps: number;
  setTheme: (i: number) => void;
  setCar: (i: number) => void;
  setLaps: (n: number) => void;
  onStart: () => void;
  best: number | null;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-[10px] font-bold tracking-widest text-white/50 uppercase">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
}

const norm = (v: number, a: number, b: number) => 0.28 + ((v - a) / (b - a)) * 0.72;

export default function Menu({ themeIdx, carIdx, laps, setTheme, setCar, setLaps, onStart, best }: Props) {
  const theme = THEMES[themeIdx];
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto bg-gradient-to-r from-[#07030f]/95 via-[#07030f]/70 to-[#07030f]/20">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col justify-center gap-6 px-5 py-8 md:px-10">
        {/* logo */}
        <header className="anim-in">
          <div className="font-display text-[11px] font-bold tracking-[0.5em] text-cyan-300/90 md:text-xs">ARCADE GRAND PRIX</div>
          <h1
            className="font-display -ml-1 text-5xl leading-none font-black italic md:text-7xl"
            style={{
              background: 'linear-gradient(180deg,#fff 0%,#ffd7f0 35%,#ff4fa8 60%,#7a3cff 100%)',
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              filter: 'drop-shadow(0 4px 24px rgba(255,46,147,0.55))',
            }}
          >
            APEX HORIZON
          </h1>
          <p className="mt-2 max-w-md text-base font-medium text-white/70 md:text-lg">
            Chase the horizon. Beat 11 rivals, collect nitro, and own the circuit.
          </p>
        </header>

        {/* circuits */}
        <section className="anim-in" style={{ animationDelay: '0.08s' }}>
          <h2 className="font-display mb-2 text-xs font-bold tracking-[0.3em] text-white/60">01 · CIRCUIT</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {THEMES.map((t, i) => (
              <button
                key={t.id}
                onClick={() => setTheme(i)}
                className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-200 ${
                  i === themeIdx ? 'scale-[1.02] border-white/80 shadow-[0_0_30px_rgba(255,255,255,0.25)]' : 'border-white/15 opacity-80 hover:opacity-100'
                }`}
              >
                <div className="h-16 w-full sm:h-20" style={{ background: t.preview }} />
                <div className="bg-black/60 p-3 backdrop-blur">
                  <div className="font-display text-sm font-bold text-white">{t.name}</div>
                  <div className="text-sm text-white/60">{t.tagline}</div>
                </div>
                {i === themeIdx && <div className="absolute top-2 right-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-black">SELECTED</div>}
              </button>
            ))}
          </div>
        </section>

        {/* cars */}
        <section className="anim-in" style={{ animationDelay: '0.16s' }}>
          <h2 className="font-display mb-2 text-xs font-bold tracking-[0.3em] text-white/60">02 · MACHINE</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {CARS.map((c, i) => {
              const sel = i === carIdx;
              return (
                <button
                  key={c.id}
                  onClick={() => setCar(i)}
                  className={`relative rounded-xl border bg-gradient-to-b from-white/10 to-black/50 p-2 pb-3 text-left backdrop-blur transition-all duration-200 ${
                    sel ? 'scale-[1.02] border-white/80' : 'border-white/15 opacity-80 hover:opacity-100'
                  }`}
                  style={sel ? { boxShadow: `0 0 34px ${c.body}66` } : undefined}
                >
                  <div className="-mt-1 flex h-[110px] items-end justify-center overflow-hidden sm:h-[130px]">
                    <div className="origin-bottom scale-[0.78] sm:scale-90">
                      <CarPreview car={c} active={sel} />
                    </div>
                  </div>
                  <div className="px-1.5">
                    <div className="font-display text-sm font-bold text-white">{c.name}</div>
                    <div className="mb-2 text-xs text-white/55">{c.tag}</div>
                    <div className="space-y-1">
                      <Stat label="Speed" value={norm(c.top, 0.93, 1.08)} color="#00f0ff" />
                      <Stat label="Accel" value={norm(c.accel, 0.84, 1.16)} color="#ffd166" />
                      <Stat label="Grip" value={norm(c.grip, 0.88, 1.17)} color="#5dff9a" />
                      <Stat label="Nitro" value={norm(c.nitro, 0.88, 1.42)} color="#ff4fa8" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* start row */}
        <section className="anim-in flex flex-wrap items-end gap-5" style={{ animationDelay: '0.24s' }}>
          <div>
            <h2 className="font-display mb-2 text-xs font-bold tracking-[0.3em] text-white/60">03 · LAPS</h2>
            <div className="flex overflow-hidden rounded-lg border border-white/20 bg-black/40">
              {[2, 3, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setLaps(n)}
                  className={`font-display w-14 py-2.5 text-sm font-black transition-colors ${
                    laps === n ? 'bg-white text-black' : 'text-white/70 hover:bg-white/10'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="font-display mb-2 text-xs font-bold tracking-[0.3em] text-white/60">RECORD</div>
            <div className="font-display rounded-lg border border-white/20 bg-black/40 px-4 py-2.5 text-sm font-black text-amber-300">
              {best ? fmtTime(best) : '--:--.--'}
            </div>
          </div>

          <button
            onClick={onStart}
            className="btn-glow font-display group relative ml-auto overflow-hidden rounded-xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 px-10 py-4 text-lg font-black tracking-widest text-white italic transition-transform hover:scale-105 active:scale-95 md:px-14 md:text-xl"
          >
            <span className="relative z-10">START ENGINE ▶</span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>
        </section>

        <footer className="anim-in flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/55" style={{ animationDelay: '0.3s' }}>
          <span><b className="text-white/90">↑ / W</b> accelerate</span>
          <span><b className="text-white/90">↓ / S</b> brake</span>
          <span><b className="text-white/90">← → / A D</b> steer</span>
          <span><b className="text-cyan-300">SHIFT / SPACE</b> nitro</span>
          <span><b className="text-white/90">P</b> pause</span>
          <span><b className="text-white/90">M</b> mute</span>
          <span className="text-white/40">Tip: tuck behind rivals for a slipstream, grab blue orbs for nitro.</span>
        </footer>
        <div className="hidden text-xs text-white/30">{theme.name}</div>
      </div>
    </div>
  );
}
