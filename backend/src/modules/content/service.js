// Medya içerik türleri için ortak CRUD servisi.
// Akış: dosyalar medya hattından geçer (ingestUpload) → kayıt yazılır; başarısızlıkta yeni asset'ler
// geri alınır. Silme/dosya değiştirme eski asset'leri aynı transaction'da silip dosyalarını
// StorageDeletionJob kuyruğuna yazar.
import { AppError, NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { deleteAssetsInTx, hooks, ingestUpload, toAssetDto } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';
import { visibilityOf } from '../public/visibility.js';
import { refreshTodayFor, rotationUsageOf } from '../rotation/service.js';
import { hotspotsOf, assertHotspots } from './cursor.js';

/** audit metadata'sında değeri yazılabilecek alanlar. */
const SAFE_AUDIT_FIELDS = ['title', 'isActive', 'sortOrder'];
const STATUS_PRIORITY = ['FAILED', 'PROCESSING', 'PENDING', 'READY'];

const delegate = (def) => prisma[def.model];
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/** Kayıttaki tüm asset'lerin en "kötü" durumu (rozet: Hata > İşleniyor > Bekliyor > Hazır). */
export const combinedStatus = (assets) =>
  STATUS_PRIORITY.find((s) => assets.some((a) => a?.processingStatus === s)) ?? 'READY';

export function toContentDto(def, record) {
  const assets = def.slots.map((s) => record[s.relation]);
  const dto = {
    id: record.id,
    publicId: record.publicId,
    title: record.title,
    ...pick(record, def.flags),
    ...(def.sortable && { sortOrder: record.sortOrder }),
    ...('downloadCount' in record && { downloadCount: record.downloadCount }),
    ...(def.type === 'musics' && { artist: record.artist, durationMs: record.durationMs }),
    ...(def.type === 'cursors' && hotspotsOf(record)),
    files: Object.fromEntries(def.slots.map((s) => [s.field, toAssetDto(record[s.relation])])),
    status: combinedStatus(assets),
    visibility: visibilityOf(def.type, record),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
  return dto;
}

async function findOr404(def, id) {
  const record = await delegate(def).findUnique({ where: { id }, include: def.include });
  if (!record) throw new NotFoundError('Kayıt bulunamadı.');
  return record;
}

const SORTABLE = { title: 'title', createdAt: 'createdAt', sortOrder: 'sortOrder' };

function orderByOf(def, sort) {
  const [field, dir] = (sort ?? '').split(':');
  const column =
    SORTABLE[field] && (field !== 'sortOrder' || def.sortable) ? SORTABLE[field] : null;
  if (!column) return def.sortable ? { sortOrder: 'asc' } : { createdAt: 'desc' };
  return { [column]: dir === 'desc' ? 'desc' : 'asc' };
}

/** @param {{ q?: string, type?: string, status?: string, sort?: string, page: number,
 *   pageSize: number } & Record<string, unknown>} query */
export async function listContent(def, query) {
  const where = {
    ...(query.q && { title: { contains: query.q, mode: 'insensitive' } }),
    ...pick(
      query,
      def.flags.filter((f) => query[f] !== undefined),
    ),
    ...(query.type && { [def.primary.relation]: { mediaType: query.type } }),
    ...(query.status && {
      OR: def.slots.map((s) => ({ [s.relation]: { processingStatus: query.status } })),
    }),
  };
  const [rows, total] = await Promise.all([
    delegate(def).findMany({
      where,
      include: def.include,
      orderBy: [orderByOf(def, query.sort), { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    delegate(def).count({ where }),
  ]);
  return {
    items: rows.map((r) => toContentDto(def, r)),
    meta: { page: query.page, pageSize: query.pageSize, total },
  };
}

export async function getContent(def, id) {
  const record = await findOr404(def, id);
  const usage = {};
  if (def.type === 'pfps') {
    usage.heroFixed = (await prisma.heroSettings.count({ where: { fixedProfileMediaId: id } })) > 0;
  }
  Object.assign(usage, await rotationUsageOf(def.type, id));
  return { ...toContentDto(def, record), usage };
}

/** Hata ayrıntısını hangi dosya alanından geldiğine bağlar (istemci alan hatası gösterir). */
function tagField(err, field) {
  if (!(err instanceof AppError) || err.status >= 500) return err;
  err.details = Array.isArray(err.details)
    ? err.details.map((d) => ({ ...d, path: field }))
    : [{ path: field, message: err.message }];
  return err;
}

/** Kullanılmayan (yeni yüklenmiş) asset'leri geri alır: kayıt + dosya kuyruğu. */
async function discardAssets(assets) {
  const list = assets.filter(Boolean);
  if (list.length === 0) return;
  await prisma.$transaction((tx) => deleteAssetsInTx(tx, list, { skipInUse: true }));
  hooks.onDeletionQueued();
}

/** Yuvaları sırayla medya hattından geçirir; biri başarısızsa öncekiler geri alınır. */
async function ingestSlots(def, files, adminId, ctx) {
  const done = [];
  try {
    for (const slot of def.slots) {
      const file = files[slot.field];
      if (!file) continue;
      try {
        done.push({ slot, ...(await ingestUpload({ kind: slot.kind, file, adminId, ctx })) });
      } catch (err) {
        throw tagField(err, slot.field);
      }
    }
  } catch (err) {
    await discardAssets(done.map((d) => d.asset));
    throw err;
  }
  return {
    assets: Object.fromEntries(done.map((d) => [d.slot.field, d.asset])),
    duplicates: done
      .filter((d) => d.duplicateOf)
      .map((d) => ({ field: d.slot.field, ...d.duplicateOf })),
  };
}

async function nextSortOrder(def) {
  const { _max } = await delegate(def).aggregate({ _max: { sortOrder: true } });
  return (_max.sortOrder ?? -10) + 10;
}

const audit = (def, verb, { adminId, ctx, entityId, metadata }) =>
  writeAudit({
    adminId,
    action: `${def.audit}_${verb}`,
    entityType: def.entityType,
    entityId,
    metadata,
    ctx,
  });

/** POST {base} — görsel 201, video (PENDING) 202. */
export async function createContent(def, { adminId, files, input, ctx }) {
  const { assets, duplicates } = await ingestSlots(def, files, adminId, ctx);
  let record;
  try {
    if (def.type === 'cursors') assertHotspots({ ...hotspotsOf({}), ...input }, assets);
    const data = { ...input };
    for (const s of def.slots) data[s.fk] = assets[s.field].id;
    if (def.type === 'musics') data.durationMs = assets.audio.durationMs ?? null;
    if (def.sortable) data.sortOrder = await nextSortOrder(def);
    record = await delegate(def).create({ data, include: def.include });
  } catch (err) {
    await discardAssets(Object.values(assets));
    throw err;
  }
  invalidateSiteCache();
  await audit(def, 'CREATED', {
    adminId,
    ctx,
    entityId: record.id,
    metadata: { fields: Object.keys(input), ...pick(record, SAFE_AUDIT_FIELDS) },
  });
  return { item: toContentDto(def, record), duplicates };
}

/** PATCH {base}/:id — yalnızca alanlar (dosya değişmez). */
export async function updateContent(def, id, { adminId, input, ctx }) {
  const current = await findOr404(def, id);
  if (def.type === 'cursors') {
    assertHotspots({ ...hotspotsOf(current), ...input }, current);
  }
  const record = await delegate(def).update({ where: { id }, data: input, include: def.include });
  if ('isActive' in input || 'rotationEnabled' in input) await refreshTodayFor(def.type);
  invalidateSiteCache();
  await audit(def, 'UPDATED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { fields: Object.keys(input), ...pick(input, SAFE_AUDIT_FIELDS) },
  });
  return toContentDto(def, record);
}

/** PUT {base}/:id/file — yeni asset(ler) bağlanır, eskiler silme kuyruğuna yazılır. */
export async function replaceContentFiles(def, id, { adminId, files, input, ctx }) {
  const current = await findOr404(def, id);
  const { assets, duplicates } = await ingestSlots(def, files, adminId, ctx);
  const changed = def.slots.filter((s) => assets[s.field]);
  try {
    if (def.type === 'cursors') {
      assertHotspots(
        { ...hotspotsOf(current), ...input },
        { normal: assets.normal ?? current.normal, click: assets.click ?? current.click },
      );
    }
    const data = { ...input };
    for (const s of changed) data[s.fk] = assets[s.field].id;
    if (def.type === 'musics' && assets.audio) data.durationMs = assets.audio.durationMs ?? null;
    await prisma.$transaction(async (tx) => {
      const { count } = await tx[def.model].updateMany({ where: { id }, data });
      if (count === 0) throw new NotFoundError('Kayıt bulunamadı.');
      await deleteAssetsInTx(
        tx,
        changed.map((s) => current[s.relation]),
        { skipInUse: true },
      );
    });
  } catch (err) {
    await discardAssets(Object.values(assets));
    throw err;
  }
  hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit(def, 'UPDATED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { files: changed.map((s) => s.field), fields: Object.keys(input) },
  });
  return { item: toContentDto(def, await findOr404(def, id)), duplicates };
}

/** DELETE {base}/:id — kayıt → asset'ler → dosya kuyruğu → audit. */
export async function deleteContent(def, id, { adminId, ctx }) {
  const current = await findOr404(def, id);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx[def.model].deleteMany({ where: { id } });
    if (count === 0) throw new NotFoundError('Kayıt bulunamadı.');
    await deleteAssetsInTx(
      tx,
      def.slots.map((s) => current[s.relation]),
      { skipInUse: true },
    );
  });
  hooks.onDeletionQueued();
  await refreshTodayFor(def.type); // bugünün seçimiyse yeniden seç
  invalidateSiteCache();
  await audit(def, 'DELETED', { adminId, ctx, entityId: id, metadata: { title: current.title } });
}

/** PATCH {base}/reorder — tüm kayıtlar, tek transaction, sortOrder = index × 10. */
export async function reorderContent(def, ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    delegate(def).count({ where: { id: { in: ids } } }),
    delegate(def).count(),
  ]);
  if (matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      delegate(def).update({ where: { id }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'REORDERED',
    entityType: def.entityType,
    metadata: { count: ids.length },
    ctx,
  });
}
