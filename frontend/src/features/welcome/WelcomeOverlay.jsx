// sekme oturumu başına bir kez. Önce "Connecting" bağlanma sekansı (5 sn ilerleme
// çubuğu), ardından "Successfully Connected!" + "Welcome! Please click anywhere..." ve yanıp sönen imleç.
// Yalnızca hazır olunca tıklama / Enter / Space ile kapanır ve aynı jestte müziği başlatır (autoplay).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { useMotionFx } from '@/features/hero/useMotionFx.js';
import { usePlayer } from '@/features/player/playerStore.js';
import { usePrefs } from '@/lib/prefs.js';
import { useWelcome, welcomedBefore } from './welcomeStore.js';

export const CONNECT = Object.freeze({ fillMs: 3000, finishMs: 2000, dotMs: 400, tickMs: 50 });
const TOTAL_MS = CONNECT.fillMs + CONNECT.finishMs;
const DOTS = [1, 2, 3, 2];
export const WELCOME_TEXT = 'Welcome! Please click anywhere...';
const TYPE_MS = 35;
const READY_DELAY_MS = 600;

/** 0 → %99 (3 sn, yavaşlayan), %99 → %100 (2 sn, doğrusal). */
export function progressAt(elapsed) {
  if (elapsed <= 0) return 0;
  if (elapsed < CONNECT.fillMs) {
    const t = elapsed / CONNECT.fillMs;
    return 99 * (1 - (1 - t) ** 3);
  }
  if (elapsed < TOTAL_MS) return 99 + (elapsed - CONNECT.fillMs) / CONNECT.finishMs;
  return 100;
}

/** Bağlanma zaman çizelgesi: yüzde (tam sayı), nokta sayısı ve bitti mi. */
function useConnecting(active) {
  const [state, setState] = useState({ percent: 0, dots: 1, done: false });
  useEffect(() => {
    if (!active) return undefined;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const done = elapsed >= TOTAL_MS;
      const percent = done ? 100 : Math.min(99, Math.floor(progressAt(elapsed)));
      const dots = DOTS[Math.floor(elapsed / CONNECT.dotMs) % DOTS.length];
      setState((prev) =>
        prev.percent === percent && prev.dots === dots && prev.done === done
          ? prev
          : { percent, dots, done },
      );
      if (done) clearInterval(id);
    }, CONNECT.tickMs);
    return () => clearInterval(id);
  }, [active]);
  return state;
}

/** "Welcome! …" satırını harf harf yazar; hareket kapalıysa hemen tamamı. */
function useTyped(text, active, animate) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (!animate) {
      setCount(text.length);
      return undefined;
    }
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(id);
  }, [text, active, animate]);
  return text.slice(0, count);
}

export function WelcomeOverlay() {
  const [open, setOpen] = useState(() => !welcomedBefore());
  const [ready, setReady] = useState(false);
  const ref = useRef(null);
  const startFromGesture = usePlayer((s) => s.startFromGesture);
  const lowEffects = usePrefs((s) => s.effects === 'low');
  const motionFx = useMotionFx();
  const markEntered = useWelcome((s) => s.markEntered);
  const { percent, dots, done } = useConnecting(open);
  const typed = useTyped(WELCOME_TEXT, ready, motionFx);

  // Navbar girişini bu ekranın durumuna bağla: açıksa navbar bekler.
  useLayoutEffect(() => {
    useWelcome.getState().setEntered(!open);
  }, [open]);
  useEffect(() => {
    if (!done) return undefined;
    const id = setTimeout(() => setReady(true), READY_DELAY_MS);
    return () => clearTimeout(id);
  }, [done]);

  useEffect(() => {
    if (!open) return undefined;
    ref.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const enter = () => {
    if (!ready) return; // Bağlanma bitmeden giriş yok.
    startFromGesture();
    markEntered();
    setOpen(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={ref}
          role={ready ? 'button' : undefined}
          tabIndex={ready ? 0 : -1}
          aria-label={ready ? WELCOME_TEXT : undefined}
          aria-describedby={ready ? 'welcome-hint' : undefined}
          aria-busy={ready ? undefined : true}
          onClick={enter}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              enter();
            }
          }}
          exit={lowEffects ? { opacity: 0 } : { opacity: 0, filter: 'blur(8px)' }}
          transition={{ duration: lowEffects ? 0.15 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={
            // tıklamaya dek site bileşenleri gizli (PublicLayout); yalnızca sahne arka planı
            // ve koyu metin kutusu görünür. Bağlanırken sahne hafifçe karartılır.
            'fixed inset-0 z-[var(--z-welcome)] grid place-items-center px-6 outline-none select-none transition-[background-color] duration-700 ' +
            (done ? 'bg-transparent ' : 'bg-black/35 ') +
            (ready ? 'cursor-pointer' : 'cursor-progress')
          }
        >
          <div
            lang="en"
            className="w-[min(36rem,100%)] rounded-[var(--radius-lg)] bg-black/55 px-6 py-5 font-mono text-[0.9375rem] text-white/90 backdrop-blur-md"
          >
            <div className="min-h-[1.5em]">
              {done ? (
                <m.p
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  className="text-status-online tracking-[0.04em]"
                >
                  Successfully Connected!
                </m.p>
              ) : (
                <p className="tracking-[0.04em]">
                  Connecting
                  {/* Sabit genişlik: noktalar değişirken metin kaymaz. */}
                  <span aria-hidden="true" className="inline-block w-[3ch] text-left">
                    {'.'.repeat(dots)}
                  </span>
                </p>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3" aria-hidden={done ? true : undefined}>
              <div
                role={done ? undefined : 'progressbar'}
                aria-label={done ? undefined : 'Bağlanılıyor'}
                aria-valuemin={done ? undefined : 0}
                aria-valuemax={done ? undefined : 100}
                aria-valuenow={done ? undefined : percent}
                className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15"
              >
                <div
                  className="h-full rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.55)] transition-[width] duration-100 ease-linear"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="w-[4ch] text-right text-xs text-white/70 tabular-nums">
                {percent}%
              </span>
            </div>

            <div className="mt-4 min-h-[1.5em]">
              {ready && (
                <p className="tracking-[0.04em]">
                  {typed}
                  <span
                    aria-hidden="true"
                    className={
                      'ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[0.2em] bg-current ' +
                      (motionFx ? 'welcome-caret' : '')
                    }
                  />
                </p>
              )}
            </div>
          </div>
          {/* WCAG 2.5.3: erişilebilir ad görünen metinle aynı; Türkçe açıklama ayrıca okunur. */}
          <span id="welcome-hint" className="sr-only">
            Siteye girmek için Enter ya da boşluk tuşuna bas.
          </span>
          <span className="sr-only" role="status">
            {done ? 'Bağlantı kuruldu.' : ''}
          </span>
        </m.div>
      )}
    </AnimatePresence>
  );
}
