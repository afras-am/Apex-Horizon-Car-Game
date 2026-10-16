import { useCallback, useEffect, useRef, useState } from 'react';
import { RaceEngine } from './game/engine';
import type { RaceResult } from './game/engine';
import { THEMES } from './game/themes';
import Menu from './components/Menu';
import { PauseOverlay, ResultOverlay, TouchControls } from './components/Overlays';

type Screen = 'menu' | 'racing' | 'paused' | 'result';

const bestKey = (themeId: string, laps: number) => `apex-horizon-best-${themeId}-${laps}`;
const readBest = (themeId: string, laps: number): number | null => {
  try {
    const v = localStorage.getItem(bestKey(themeId, laps));
    return v ? parseFloat(v) : null;
  } catch {
    return null;
  }
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RaceEngine | null>(null);
  const [engine, setEngine] = useState<RaceEngine | null>(null);
  const [screen, setScreen] = useState<Screen>('menu');
  const screenRef = useRef<Screen>('menu');
  const [themeIdx, setThemeIdx] = useState(0);
  const [carIdx, setCarIdx] = useState(0);
  const [laps, setLaps] = useState(3);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [record, setRecord] = useState(false);
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState<number | null>(readBest(THEMES[0].id, 3));
  const isTouch = useRef(
    typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(max-width: 900px)').matches)
  );

  const go = (s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  };

  // create engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const e = new RaceEngine(canvas);
    engineRef.current = e;
    setEngine(e);
    return () => {
      e.destroy();
      engineRef.current = null;
    };
  }, []);

  // keep background demo in sync with menu choices
  useEffect(() => {
    if (screenRef.current === 'menu') engineRef.current?.setup(themeIdx, carIdx, laps);
    setBest(readBest(THEMES[themeIdx].id, laps));
  }, [themeIdx, carIdx, laps, engine]);

  const enterMobileLandscape = useCallback(async () => {
    if (!isTouch.current) return;

    // Fullscreen + orientation lock gives supported mobile browsers a true landscape game mode.
    try {
      const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
      if (!document.fullscreenElement && root.requestFullscreen) {
        await root.requestFullscreen();
      }
    } catch {
      // Fullscreen can be blocked by the browser; the CSS landscape prompt still works.
    }

    try {
      const orientation = screen.orientation as ScreenOrientation & { lock?: (orientation: OrientationLockType) => Promise<void> };
      if (orientation.lock) await orientation.lock('landscape');
    } catch {
      // Orientation lock is not supported by every browser.
    }
  }, []);

  const begin = useCallback(async () => {
    const e = engineRef.current;
    if (!e) return;
    await enterMobileLandscape();
    e.setup(themeIdx, carIdx, laps);
    e.onFinish = (r) => {
      let isRecord = false;
      try {
        const prev = readBest(r.themeId, r.laps_n);
        if (prev === null || r.total < prev) {
          localStorage.setItem(bestKey(r.themeId, r.laps_n), String(r.total));
          isRecord = true;
        }
      } catch {
        /* ignore */
      }
      setRecord(isRecord);
      setResult(r);
      go('result');
    };
    e.input.gas = isTouch.current;
    e.start();
    go('racing');
  }, [themeIdx, carIdx, laps]);

  const toMenu = useCallback(() => {
    const e = engineRef.current;
    if (!e) return;
    e.setPaused(false);
    e.setup(themeIdx, carIdx, laps);
    setBest(readBest(THEMES[themeIdx].id, laps));
    go('menu');
  }, [themeIdx, carIdx, laps]);

  const pause = useCallback((p: boolean) => {
    const e = engineRef.current;
    if (!e) return;
    e.setPaused(p);
    go(p ? 'paused' : 'racing');
  }, []);

  // global keys + auto pause
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === 'KeyM') {
        const e = engineRef.current;
        if (e) setMuted(e.toggleMute());
      }
      if (ev.code === 'KeyP' || ev.code === 'Escape') {
        if (screenRef.current === 'racing') pause(true);
        else if (screenRef.current === 'paused') pause(false);
      }
      if (ev.code === 'Enter' && screenRef.current === 'menu') begin();
    };
    const onVis = () => {
      if (document.hidden && screenRef.current === 'racing') pause(true);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pause, begin]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#07030f] text-white" onPointerDown={() => engineRef.current?.ensureAudio()}>
      <canvas ref={canvasRef} className="game" />

      {screen === 'menu' && (
        <Menu
          themeIdx={themeIdx}
          carIdx={carIdx}
          laps={laps}
          setTheme={setThemeIdx}
          setCar={setCarIdx}
          setLaps={setLaps}
          onStart={begin}
          best={best}
        />
      )}

      {(screen === 'racing' || screen === 'paused') && (
        <div className="absolute top-3 left-1/2 flex -translate-x-1/2 gap-2" style={{ top: '11%' }}>
          <button
            onClick={() => pause(screen === 'racing')}
            className="rounded-full border border-white/25 bg-black/40 px-3 py-1 text-xs font-bold tracking-widest text-white/80 backdrop-blur hover:bg-black/60"
          >
            {screen === 'racing' ? '❚❚ PAUSE' : '▶ RESUME'}
          </button>
          <button
            onClick={() => {
              const e = engineRef.current;
              if (e) setMuted(e.toggleMute());
            }}
            className="rounded-full border border-white/25 bg-black/40 px-3 py-1 text-xs font-bold tracking-widest text-white/80 backdrop-blur hover:bg-black/60"
          >
            {muted ? '🔇 MUTED' : '🔊 SOUND'}
          </button>
        </div>
      )}

      {screen === 'racing' && isTouch.current && (
        <>
          <div className="portrait-warning z-50">
            <div className="portrait-card">
              <div className="rotate-icon">↻</div>
              <h2>ROTATE YOUR PHONE</h2>
              <p>Turn your phone sideways to play in landscape mode.</p>
            </div>
          </div>
          <TouchControls engine={engine} />
        </>
      )}

      {screen === 'paused' && <PauseOverlay onResume={() => pause(false)} onRestart={() => { pause(false); begin(); }} onQuit={toMenu} />}

      {screen === 'result' && result && <ResultOverlay result={result} record={record} onAgain={begin} onMenu={toMenu} />}
    </div>
  );
}
