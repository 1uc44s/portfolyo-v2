// sağlayıcı işçileri. Polling (GitHub 1 sa, Spotify 60 sn) ya da kalıcı bağlantı
// (Discord Gateway). Ardışık 3 hatadan sonra üstel bekleme (≤ 15 dk); 429'da Retry-After.
import { logger } from '../../lib/logger.js';
import { publicErrorMessage } from './http.js';
import { contextOf, getRow, PROVIDERS, recordFailure, recordSuccess, syncNow } from './service.js';

const MAX_BACKOFF_MS = 15 * 60_000;
const BASE_BACKOFF_MS = 60_000;
const LONG_LIVED_RETRY_MS = 60_000;

/** Bir sonraki deneme gecikmesi. @param {number} failures ardışık hata sayısı */
export function nextDelay(intervalMs, failures, retryAfterMs) {
  if (retryAfterMs) return Math.min(MAX_BACKOFF_MS, Math.max(retryAfterMs, 1000));
  if (failures === 0) return intervalMs;
  if (failures < 3) return Math.min(intervalMs, BASE_BACKOFF_MS);
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (failures - 3));
}

export function createIntegrationWorker() {
  /** @type {Map<string, { timer?: NodeJS.Timeout, stop?: () => Promise<void>, failures: number, state: object, generation: number }>} */
  const workers = new Map();
  let running = false;

  const entry = (slug) => {
    if (!workers.has(slug)) workers.set(slug, { failures: 0, state: {}, generation: 0 });
    return workers.get(slug);
  };

  async function stopOne(slug) {
    const w = entry(slug);
    w.generation += 1;
    clearTimeout(w.timer);
    w.timer = undefined;
    const stop = w.stop;
    w.stop = undefined;
    if (stop) await stop().catch(() => {});
  }

  function schedule(slug, delay, generation) {
    const w = entry(slug);
    if (!running || w.generation !== generation) return;
    clearTimeout(w.timer);
    w.timer = setTimeout(() => void tick(slug, generation), delay);
    w.timer.unref?.();
  }

  async function tick(slug, generation) {
    const w = entry(slug);
    const provider = PROVIDERS[slug];
    if (!running || w.generation !== generation) return;
    try {
      const snapshot = await syncNow(slug, { state: w.state });
      w.failures = 0;
      // Sağlayıcı duruma göre sonraki aralığı seçebilir (ör. Spotify çalarken daha sık).
      schedule(slug, provider.nextIntervalMs?.(snapshot) ?? provider.intervalMs, generation);
    } catch (err) {
      w.failures += 1;
      const delay = nextDelay(provider.intervalMs, w.failures, err?.retryAfterMs);
      logger.warn(
        { provider: slug, failures: w.failures, retryInMs: delay, error: publicErrorMessage(err) },
        'Entegrasyon senkronu başarısız',
      );
      schedule(slug, delay, generation);
    }
  }

  async function startLongLived(slug, generation) {
    const w = entry(slug);
    const provider = PROVIDERS[slug];
    try {
      const ctx = await contextOf(slug);
      const stop = await provider.start({
        config: ctx.config,
        secrets: ctx.secrets,
        onSnapshot: async (snapshot) => {
          w.failures = 0;
          await recordSuccess(slug, snapshot);
        },
        onError: (err) => recordFailure(slug, err),
      });
      if (w.generation !== generation || !running) {
        await stop();
        return;
      }
      w.stop = stop;
      w.failures = 0;
    } catch (err) {
      w.failures += 1;
      await recordFailure(slug, err).catch(() => {});
      const delay = nextDelay(LONG_LIVED_RETRY_MS, w.failures, err?.retryAfterMs);
      logger.warn(
        { provider: slug, retryInMs: delay, error: publicErrorMessage(err) },
        'Entegrasyon bağlantısı kurulamadı',
      );
      const w2 = entry(slug);
      if (!running || w2.generation !== generation) return;
      w2.timer = setTimeout(() => void startLongLived(slug, generation), delay);
      w2.timer.unref?.();
    }
  }

  async function restart(slug) {
    await stopOne(slug);
    if (!running) return;
    const w = entry(slug);
    w.failures = 0;
    w.state = {};
    const row = await getRow(slug);
    if (!row.isEnabled) return;
    const generation = w.generation;
    if (PROVIDERS[slug].longLived) void startLongLived(slug, generation);
    else schedule(slug, 0, generation);
  }

  return {
    async start() {
      running = true;
      for (const slug of Object.keys(PROVIDERS)) {
        await restart(slug).catch((err) =>
          logger.error({ err: err?.message, provider: slug }, 'Entegrasyon işçisi başlatılamadı'),
        );
      }
    },
    restart: (slug) =>
      restart(slug).catch((err) =>
        logger.error(
          { err: err?.message, provider: slug },
          'Entegrasyon işçisi yeniden başlatılamadı',
        ),
      ),
    async stop() {
      running = false;
      for (const slug of workers.keys()) await stopOne(slug);
    },
  };
}
