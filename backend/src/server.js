// graceful shutdown.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { pingDatabase, prisma } from './lib/prisma.js';
import { startScheduler } from './jobs/scheduler.js';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const app = createApp({ readinessCheck: pingDatabase });
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API dinlemede');
});

let scheduler = null;
startScheduler()
  .then((s) => {
    scheduler = s;
  })
  .catch((err) => logger.error({ err }, 'Zamanlanmış işler başlatılamadı'));

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'Kapanış başladı');

  const timer = setTimeout(() => {
    logger.error('Kapanış zaman aşımı; zorla çıkılıyor');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  server.close(async (err) => {
    if (err) logger.error({ err }, 'Sunucu kapatılamadı');
    scheduler?.stop();
    try {
      await prisma.$disconnect();
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Veritabanı bağlantısı kapatılamadı');
    }
    logger.info('Kapanış tamamlandı');
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'İşlenmemiş promise reddi');
});
