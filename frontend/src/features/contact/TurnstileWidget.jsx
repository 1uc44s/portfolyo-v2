// FR-CNT-05 — Cloudflare Turnstile. Betik yalnızca widget görünür olunca (IntersectionObserver)
// bir kez yüklenir. Token `onToken`'a, süre dolumu/hata `onToken(null)`'a gider.
// `resetKey` değişince widget sıfırlanır (gönderim sonrası yeni token gerekir).
import { useEffect, useRef, useState } from 'react';
import { usePrefs } from '@/lib/prefs.js';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise = null;

/** Testler ve tekrar denemeler için: betik yükleme sözü. */
export function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => {
      scriptPromise = null;
      script.remove();
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * @param {{ siteKey: string, onToken: (token: string|null) => void, resetKey?: number,
 *   describedBy?: string, invalid?: boolean }} props
 */
export function TurnstileWidget({ siteKey, onToken, resetKey = 0, describedBy, invalid }) {
  const host = useRef(null);
  const widget = useRef(null);
  const tokenCb = useRef(onToken);
  const theme = usePrefs((s) => s.theme);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined');
  const [state, setState] = useState('idle'); // idle | ready | failed

  useEffect(() => {
    tokenCb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (visible || !host.current) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { rootMargin: '300px' },
    );
    io.observe(host.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !siteKey) return undefined;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !host.current) return;
        widget.current = turnstile.render(host.current, {
          sitekey: siteKey,
          theme,
          language: 'tr',
          callback: (token) => tokenCb.current(token),
          'expired-callback': () => tokenCb.current(null),
          'error-callback': () => {
            tokenCb.current(null);
            return true; // Cloudflare kendi tekrar denemesini yapar
          },
        });
        setState('ready');
      })
      .catch(() => !cancelled && setState('failed'));
    return () => {
      cancelled = true;
      if (widget.current != null) window.turnstile?.remove?.(widget.current);
      widget.current = null;
    };
  }, [visible, siteKey, theme]);

  useEffect(() => {
    if (resetKey === 0 || widget.current == null) return;
    window.turnstile?.reset?.(widget.current);
    tokenCb.current(null);
  }, [resetKey]);

  return (
    <div className="grid gap-2">
      <div
        ref={host}
        data-testid="turnstile"
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        className="min-h-[65px]"
      />
      {state === 'failed' && (
        <p role="alert" className="text-danger text-xs font-medium">
          Doğrulama aracı yüklenemedi. Reklam engelleyiciyi kapatıp sayfayı yenilemeyi dene.
        </p>
      )}
    </div>
  );
}
