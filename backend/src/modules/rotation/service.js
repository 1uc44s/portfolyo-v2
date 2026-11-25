// günlük rotasyon: seçim (idempotent, advisory lock), override, çözümleme.
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { NotFoundError, ValidationError } from '../../lib/httpError.js';
import { addDays, istanbulDate, nextIstanbulMidnight, toDbDate } from '../../lib/time.js';
import { writeAudit } from '../audit/service.js';
import { mediaUrl } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';
import { pickCandidate } from './pick.js';

const READY = { processingStatus: 'READY' };

/** Kategori → model, FK sütunu, uygunluk koşulu ve medya ilişkileri. */
export const CATEGORIES = Object.freeze({
  BACKGROUND: {
    model: 'background',
    fk: 'backgroundId',
    contentType: 'backgrounds',
    ready: { asset: READY },
    include: { asset: true },
  },
  MUSIC: {
    model: 'music',
    fk: 'musicId',
    contentType: 'musics',
    ready: { audio: READY, cover: READY },
    include: { audio: true, cover: true },
  },
  PFP: {
    model: 'profileMedia',
    fk: 'profileMediaId',
    contentType: 'pfps',
    ready: { asset: READY },
    include: { asset: true },
  },
  CURSOR: {
    model: 'cursorSet',
    fk: 'cursorSetId',
    contentType: 'cursors',
    ready: { normal: READY, click: READY },
    include: { normal: true, click: true },
  },
  // 2026-11-16 — Hero isim GIF katmanı.
  NAME_OVERLAY: {
    model: 'nameOverlay',
    fk: 'nameOverlayId',
    contentType: 'name-overlays',
    ready: { asset: READY },
    include: { asset: true },
  },
});

export const ROTATION_CATEGORIES = Object.keys(CATEGORIES);
export const categoryOfContentType = (type) =>
  ROTATION_CATEGORIES.find((c) => CATEGORIES[c].contentType === type) ?? null;

/** rotasyon havuzu koşulu. */
const poolWhere = (cat) => ({ isActive: true, rotationEnabled: true, ...cat.ready });
/** Override için: aktif + hazır yeter (rotationEnabled şart değil). */
const usableWhere = (cat) => ({ isActive: true, ...cat.ready });

/**
 * (kategori, gün) seçimi. Kayıt varsa ve içerik hâlâ uygunsa aynen döner.
 * @param {string} category
 * @param {string} day "YYYY-MM-DD" (İstanbul)
 * @param {{ force?: boolean, rng?: (n: number) => number }} [options]
 *   force: geçerli seçimi bile değiştir ("Şimdi yeniden seç")
 * @returns {Promise<number|null>} seçilen içerik id'si
 */
export async function selectForDate(category, day, { force = false, rng } = {}) {
  const cat = CATEGORIES[category];
  const selectedDate = toDbDate(day);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`rotation:${category}`}))`;

    const existing = await tx.dailyContentSelection.findUnique({
      where: { category_selectedDate: { category, selectedDate } },
    });
    const currentId = existing?.[cat.fk] ?? null;
    if (existing && currentId && !force) {
      const stillEligible = await tx[cat.model].count({
        where: { id: currentId, ...poolWhere(cat) },
      });
      if (stillEligible) return currentId;
    }

    const pool = (
      await tx[cat.model].findMany({
        where: poolWhere(cat),
        select: { id: true },
        orderBy: { id: 'asc' },
      })
    ).map((r) => r.id);

    const { _max } = await tx.dailyContentSelection.aggregate({
      where: { category },
      _max: { cycleNumber: true },
    });
    const cycle = _max.cycleNumber ?? 1;
    const used = (
      await tx.dailyContentSelection.findMany({
        where: {
          category,
          cycleNumber: cycle,
          [cat.fk]: { not: null },
          ...(existing && { id: { not: existing.id } }),
        },
        select: { [cat.fk]: true },
      })
    ).map((r) => r[cat.fk]);
    const yesterday = await tx.dailyContentSelection.findUnique({
      where: { category_selectedDate: { category, selectedDate: toDbDate(addDays(day, -1)) } },
      select: { [cat.fk]: true },
    });

    const choice = pickCandidate({
      pool,
      used,
      previous: yesterday?.[cat.fk] ?? null,
      exclude: force ? currentId : null,
      rng,
    });
    const data = {
      [cat.fk]: choice?.id ?? null,
      cycleNumber: choice?.newCycle ? cycle + 1 : cycle,
    };
    if (existing) {
      await tx.dailyContentSelection.update({ where: { id: existing.id }, data });
    } else if (choice) {
      await tx.dailyContentSelection.create({ data: { category, selectedDate, ...data } });
    }
    return choice?.id ?? null;
  });
}

/** Bugünün kaydı yoksa/uygunsuzsa oluşturur (kaçırılan cron, açılış, silme sonrası). */
export async function ensureToday(now = Date.now()) {
  const day = istanbulDate(now);
  const result = {};
  for (const category of ROTATION_CATEGORIES) {
    result[category] = await selectForDate(category, day);
  }
  invalidateSiteCache();
  return result;
}

/** içerik silindi/pasif oldu: bugünün seçimini tazele (uygunsa dokunmaz). */
export async function refreshTodayFor(contentType) {
  const category = categoryOfContentType(contentType);
  if (!category) return;
  try {
    await selectForDate(category, istanbulDate());
    invalidateSiteCache();
  } catch (err) {
    logger.error({ err, category }, 'Bugünün rotasyon seçimi tazelenemedi');
  }
}

/** Süresi dolan override'ları siler. */
export const purgeExpiredOverrides = (now = new Date()) =>
  prisma.contentOverride.deleteMany({ where: { validUntil: { lte: now } } });

/** daily cron: süresi dolan override'lar + bugünün seçimleri. */
export async function runDailyRotation(now = Date.now()) {
  await purgeExpiredOverrides(new Date(now));
  return ensureToday(now);
}

async function loadUsable(category, id) {
  const cat = CATEGORIES[category];
  return prisma[cat.model].findFirst({
    where: { id, ...usableWhere(cat) },
    include: cat.include,
  });
}

/**
 * çözümleme: geçerli override → bugünkü otomatik seçim → null.
 * @returns {Promise<{ record: object, source: 'MANUAL'|'AUTO' } | null>}
 */
export async function resolveToday(category, now = Date.now()) {
  const cat = CATEGORIES[category];
  const override = await prisma.contentOverride.findUnique({ where: { category } });
  if (override && override.validUntil.getTime() > now) {
    const record = await loadUsable(category, override[cat.fk]);
    if (record) return { record, source: 'MANUAL' };
  }
  const id = await selectForDate(category, istanbulDate(now));
  if (!id) return null;
  const record = await loadUsable(category, id);
  return record ? { record, source: 'AUTO' } : null;
}

export async function setOverride(category, contentId, { adminId, ctx }) {
  const cat = CATEGORIES[category];
  const record = await loadUsable(category, contentId);
  if (!record) {
    throw new ValidationError([
      { path: 'contentId', message: 'İçerik bulunamadı, pasif ya da henüz işlenmedi.' },
    ]);
  }
  const validUntil = nextIstanbulMidnight();
  const fks = Object.fromEntries(ROTATION_CATEGORIES.map((c) => [CATEGORIES[c].fk, null]));
  const data = { ...fks, [cat.fk]: contentId, validUntil, createdById: adminId };
  await prisma.contentOverride.upsert({
    where: { category },
    create: { category, ...data },
    update: data,
  });
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'ROTATION_OVERRIDE_SET',
    entityType: 'ContentOverride',
    entityId: category,
    metadata: { contentId, title: record.title },
    ctx,
  });
  return { validUntil };
}

export async function clearOverride(category, { adminId, ctx }) {
  const { count } = await prisma.contentOverride.deleteMany({ where: { category } });
  if (count === 0) throw new NotFoundError('Bu kategori için manuel seçim yok.');
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'ROTATION_OVERRIDE_CLEARED',
    entityType: 'ContentOverride',
    entityId: category,
    ctx,
  });
}

/** bugünkü otomatik seçimi aynı döngüden başka bir içerikle değiştir. */
export async function reselect(category, { adminId, ctx }) {
  const id = await selectForDate(category, istanbulDate(), { force: true });
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'ROTATION_RESELECTED',
    entityType: 'DailyContentSelection',
    entityId: category,
    metadata: { contentId: id },
    ctx,
  });
  return id;
}

/** İçerik kaydının admin özeti (kart önizlemesi). */
function summarize(category, record) {
  if (!record) return null;
  const asset = { BACKGROUND: 'asset', MUSIC: 'cover', PFP: 'asset', CURSOR: 'normal' }[category];
  const media = record[asset];
  return {
    id: record.id,
    title: record.title,
    mediaType: media?.mediaType ?? null,
    previewUrl: media ? mediaUrl(media, media.thumbnailKey ? 'thumb' : 'main') : null,
  };
}

/** GET /api/admin/rotation */
export async function getRotationOverview() {
  const day = istanbulDate();
  const overview = {};
  for (const category of ROTATION_CATEGORIES) {
    const cat = CATEGORIES[category];
    const resolved = await resolveToday(category);
    const override = await prisma.contentOverride.findUnique({ where: { category } });
    const overrideActive = override && override.validUntil.getTime() > Date.now();
    const [{ _max }, total] = await Promise.all([
      prisma.dailyContentSelection.aggregate({
        where: { category },
        _max: { cycleNumber: true },
      }),
      prisma[cat.model].count({ where: poolWhere(cat) }),
    ]);
    const cycle = _max.cycleNumber ?? 1;
    const used = await prisma.dailyContentSelection.count({
      where: { category, cycleNumber: cycle, [cat.fk]: { not: null } },
    });
    overview[category] = {
      contentType: cat.contentType,
      today: resolved
        ? { item: summarize(category, resolved.record), source: resolved.source }
        : null,
      override: overrideActive
        ? { contentId: override[cat.fk], validUntil: override.validUntil }
        : null,
      cycle: { number: cycle, used: Math.min(used, total), total },
    };
  }
  return { date: day, categories: overview };
}

/** İçerik detayı için kullanım bilgisi (rozetleri). */
export async function rotationUsageOf(contentType, id) {
  const category = categoryOfContentType(contentType);
  if (!category) return {};
  const cat = CATEGORIES[category];
  const [selection, override] = await Promise.all([
    prisma.dailyContentSelection.findUnique({
      where: { category_selectedDate: { category, selectedDate: toDbDate(istanbulDate()) } },
      select: { [cat.fk]: true },
    }),
    prisma.contentOverride.findUnique({ where: { category } }),
  ]);
  const manual = override && override.validUntil.getTime() > Date.now() && override[cat.fk] === id;
  return { todaySelected: selection?.[cat.fk] === id, manualSelected: Boolean(manual) };
}
