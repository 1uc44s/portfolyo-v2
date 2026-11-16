// ARCHITECTURE.md §9 — zamanlanmış işler tek yerde. Her iş try/catch ile sarılır, üst üste binmez.
import { logger } from '../lib/logger.js';
import { hooks } from '../modules/media/service.js';
import { isFfmpegAvailable } from '../modules/media/ffmpeg.js';
import { ensureStorageDirs } from '../storage/index.js';
import { createMediaQueue } from './mediaQueue.js';
import { runStorageGc } from './storageGc.js';
import { cleanupTmp } from './tmpCleanup.js';
import { rotateDailySalt } from './dailySalt.js';
import { ensureToday, runDailyRotation } from '../modules/rotation/service.js';
import { purgeExpiredMessages } from '../modules/contact/service.js';
import { runRetention } from '../modules/analytics/service.js';
import { hooks as integrationHooks } from '../modules/integrations/service.js';
import { createIntegrationWorker } from '../modules/integrations/worker.js';
import { nextIstanbulMidnight } from '../lib/time.js';

/** Her İstanbul gece yarısında çalışır (ARCHITECTURE §9: `0 0 * * *` Europe/Istanbul). */
function scheduleMidnight(job, timers) {
  const arm = () => {
    const delay = Math.max(1000, nextIstanbulMidnight().getTime() - Date.now() + 1000);
    const timer = setTimeout(async () => {
      await job();
      arm();
    }, delay);
    timer.unref();
    timers.push(timer);
  };
  arm();
}

function guarded(name, fn) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      logger.error({ err, job: name }, 'Zamanlanmış iş başarısız');
    } finally {
      running = false;
    }
  };
}

export async function startScheduler() {
  await ensureStorageDirs();
  const timers = [];
  const every = (ms, job) => {
    const timer = setInterval(job, ms);
    timer.unref();
    timers.push(timer);
  };

  const gc = guarded('storage.gc', runStorageGc);
  const tmp = guarded('uploads.tmpCleanup', cleanupTmp);
  every(60_000, gc);
  every(60 * 60_000, tmp);

  // F8 — gece yarısı: önce tuz, sonra rotasyon. Saatlik ensure kaçırılan gece yarısını telafi eder.
  const daily = guarded('rotation.daily', async () => {
    await rotateDailySalt();
    await runDailyRotation();
  });
  const ensure = guarded('rotation.ensure', () => ensureToday());
  // F14 — FR-MSG-05: saklama süresi (12 ay) dolan iletişim mesajları.
  const retention = guarded('contact.retention', () => purgeExpiredMessages());
  scheduleMidnight(daily, timers);
  scheduleMidnight(retention, timers);
  void retention();
  // F16 — SRS §11: analitik 13 ay, indirme hash'i 90 gün, audit 24 ay, oturum 30 gün, sıfırlama 7 gün.
  const cleanup = guarded('retention.cleanup', async () => {
    const counts = await runRetention();
    logger.info({ job: 'retention.cleanup', ...counts }, 'Saklama temizliği tamamlandı');
  });
  scheduleMidnight(cleanup, timers);
  void cleanup();
  every(60 * 60_000, ensure);
  void daily();

  // F15 — entegrasyon işçileri; ayar değişince ilgili sağlayıcı yeniden başlar.
  const integrationWorker = createIntegrationWorker();
  integrationHooks.onChanged = (slug) => void integrationWorker.restart(slug);
  void integrationWorker.start();

  const queue = createMediaQueue();
  hooks.onVideoQueued = queue.kick;
  hooks.onDeletionQueued = () => setImmediate(gc);
  await queue.start();
  void gc();
  void tmp();

  if (!(await isFfmpegAvailable())) {
    logger.warn(
      'FFmpeg bulunamadı: video yüklemeleri 503 MEDIA_PROCESSOR_UNAVAILABLE ile reddedilir',
    );
  }

  return {
    stop() {
      queue.stop();
      for (const timer of timers) {
        clearInterval(timer);
        clearTimeout(timer);
      }
      hooks.onVideoQueued = () => {};
      hooks.onDeletionQueued = () => {};
      integrationHooks.onChanged = () => {};
      void integrationWorker.stop();
    },
  };
}
