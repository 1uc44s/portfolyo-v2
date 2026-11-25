// (2026-11-16) — canlı durum akışı (Server-Sent Events): snapshot değişince açık sayfalara
// anında gönderilir; sayfa yenilemeden "Oynuyor / Dinliyor / Ses kanalında" güncellenir.
// Tek yönlü (sunucu → tarayıcı) olduğu için WebSocket yerine SSE: aynı origin, CSP `connect-src 'self'`,
// tarayıcı kendisi yeniden bağlanır. Ziyaretçi isteği dış API çağrısı tetiklemez (yalnızca snapshot).
import { EventEmitter } from 'node:events';
import { logger } from '../../lib/logger.js';

export const MAX_STREAMS = 300;
export const HEARTBEAT_MS = 25_000;

const bus = new EventEmitter();
bus.setMaxListeners(MAX_STREAMS + 10);
let open = 0;

/** Snapshot yazıldı / ayar değişti: o sağlayıcının dinleyicilerine haber ver. */
export function emitStatusChange(slug) {
  bus.emit('change', slug);
}

export const openStreamCount = () => open;

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} slug
 * @param {(slug: string) => Promise<object>} load public status okuyucu
 */
export async function streamStatus(req, res, slug, load) {
  if (open >= MAX_STREAMS) {
    res
      .status(503)
      .set('Retry-After', '30')
      .json({
        error: { code: 'BUSY', message: 'Canlı bağlantı sınırına ulaşıldı.' },
      });
    return;
  }
  open += 1;
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  let closed = false;
  let sending = Promise.resolve();
  const write = (chunk) => {
    if (closed) return;
    res.write(chunk);
    res.flush?.(); // compression varsa tamponu boşalt
  };
  const send = () => {
    sending = sending
      .then(async () => {
        const status = await load(slug);
        write(`event: status\ndata: ${JSON.stringify(status)}\n\n`);
      })
      .catch((err) => logger.warn({ err: err?.message, slug }, 'Canlı durum gönderilemedi'));
  };
  const onChange = (changed) => {
    if (changed === slug) send();
  };

  write('retry: 5000\n\n');
  send();
  bus.on('change', onChange);
  const heartbeat = setInterval(() => write(': ping\n\n'), HEARTBEAT_MS);
  heartbeat.unref?.();

  req.on('close', () => {
    closed = true;
    open -= 1;
    clearInterval(heartbeat);
    bus.off('change', onChange);
  });
}
