// günün cursor seti; yalnızca ince işaretçili cihazlarda (pointer: fine).
// Basılıyken tıklama imleci. Dosya yüklenemezse CSS 'auto'ya düşer.
import { useEffect } from 'react';
import { useSite } from '@/features/site/useSite.js';

const STYLE_ID = 'site-cursor';
const decl = ({ url, hotspot: [x, y] }) => `url("${encodeURI(url)}") ${x} ${y}, auto`;

export function CursorManager() {
  const { data } = useSite();
  const cursor = data?.today?.cursor;

  useEffect(() => {
    if (!cursor || !window.matchMedia?.('(pointer: fine)').matches) return undefined;
    const root = document.documentElement;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      `html, html a, html button, html [role="button"] { cursor: ${decl(cursor.normal)}; }`,
      `html[data-pressed] , html[data-pressed] * { cursor: ${decl(cursor.click)} !important; }`,
    ].join('\n');
    document.head.append(style);

    const press = () => root.setAttribute('data-pressed', '');
    const release = () => root.removeAttribute('data-pressed');
    window.addEventListener('pointerdown', press);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('blur', release);
    return () => {
      style.remove();
      release();
      window.removeEventListener('pointerdown', press);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('blur', release);
    };
  }, [cursor]);

  return null;
}
