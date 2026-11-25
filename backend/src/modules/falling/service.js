// yağan öğeler (görsel veya kısa metin). Aktif olanların hepsi
// public sayfalarda birlikte yağar. Görseller FALLING_IMAGE hattından (≤ 256 px'e küçültülür).
import { FALLING_LIMITS } from '@my-portfolyo/shared';
import { AppError, NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { deleteAssetsInTx, hooks, ingestUpload, mediaUrl, toAssetDto } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';

const KIND = 'FALLING_IMAGE';
const ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }];
const include = { image: true };

const audit = (action, { adminId, ctx, entityId, metadata }) =>
  writeAudit({ adminId, action, entityType: 'FallingItem', entityId, metadata, ctx });

const toDto = (item) => ({
  id: item.id,
  kind: item.kind,
  text: item.text,
  size: item.size,
  isActive: item.isActive,
  sortOrder: item.sortOrder,
  image: item.image ? toAssetDto(item.image) : null,
});

export async function listFallingItems() {
  const items = await prisma.fallingItem.findMany({ orderBy: ORDER, include });
  return { items: items.map(toDto), limits: FALLING_LIMITS };
}

async function findOr404(id) {
  const item = await prisma.fallingItem.findUnique({ where: { id }, include });
  if (!item) throw new NotFoundError('Öğe bulunamadı.');
  return item;
}

export async function createItem(input, file, { adminId, ctx }) {
  if ((await prisma.fallingItem.count()) >= FALLING_LIMITS.maxItems) {
    throw new AppError(
      409,
      'LIMIT_REACHED',
      `En fazla ${FALLING_LIMITS.maxItems} öğe eklenebilir.`,
    );
  }
  if (input.kind === 'IMAGE' && !file) {
    throw new ValidationError([{ path: 'image', message: 'Görsel zorunlu.' }]);
  }
  if (input.kind === 'TEXT' && file) {
    throw new ValidationError([{ path: 'image', message: 'Metin öğesine görsel eklenemez.' }]);
  }
  let asset = null;
  let duplicateOf = null;
  if (file) ({ asset, duplicateOf } = await ingestUpload({ kind: KIND, file, adminId, ctx }));
  const last = await prisma.fallingItem.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.fallingItem.create({
    data: {
      kind: input.kind,
      text: input.kind === 'TEXT' ? input.text : null,
      imageAssetId: asset?.id ?? null,
      size: input.size,
      isActive: input.isActive,
      sortOrder: (last._max.sortOrder ?? -10) + 10,
    },
    include,
  });
  invalidateSiteCache();
  await audit('FALLING_ITEM_CREATED', {
    adminId,
    ctx,
    entityId: item.id,
    metadata: { kind: item.kind },
  });
  return { item: toDto(item), duplicateOf };
}

export async function updateItem(id, input, { adminId, ctx }) {
  const current = await findOr404(id);
  if (input.text !== undefined && current.kind !== 'TEXT') {
    throw new ValidationError([
      { path: 'text', message: 'Yalnızca metin öğesinin metni değişir.' },
    ]);
  }
  const item = await prisma.fallingItem.update({ where: { id }, data: input, include });
  invalidateSiteCache();
  await audit('FALLING_ITEM_UPDATED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });
  return toDto(item);
}

export async function replaceImage(id, file, { adminId, ctx }) {
  const current = await findOr404(id);
  if (current.kind !== 'IMAGE') {
    throw new ValidationError([{ path: 'image', message: 'Metin öğesine görsel eklenemez.' }]);
  }
  const { asset, duplicateOf } = await ingestUpload({ kind: KIND, file, adminId, ctx });
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.fallingItem.update({
      where: { id },
      data: { imageAssetId: asset.id },
      include,
    });
    if (current.image) await deleteAssetsInTx(tx, [current.image], { skipInUse: true });
    return updated;
  });
  if (current.image) hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('FALLING_ITEM_UPDATED', { adminId, ctx, entityId: id, metadata: { image: true } });
  return { item: toDto(item), duplicateOf };
}

export async function reorderItems(ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    prisma.fallingItem.count({ where: { id: { in: ids } } }),
    prisma.fallingItem.count(),
  ]);
  if (matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((itemId, index) =>
      prisma.fallingItem.update({ where: { id: itemId }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('REORDERED', {
    adminId,
    ctx,
    metadata: { entity: 'FallingItem', count: ids.length },
  });
}

export async function deleteItem(id, { adminId, ctx }) {
  const current = await findOr404(id);
  await prisma.$transaction(async (tx) => {
    await tx.fallingItem.delete({ where: { id } });
    if (current.image) await deleteAssetsInTx(tx, [current.image], { skipInUse: true });
  });
  if (current.image) hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('FALLING_ITEM_DELETED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { kind: current.kind },
  });
}

/** Public: aktif + (metin ya da READY görsel). Site payload'ına girer. */
export async function listPublicFalling() {
  const items = await prisma.fallingItem.findMany({
    where: {
      isActive: true,
      OR: [{ kind: 'TEXT' }, { image: { processingStatus: 'READY' } }],
    },
    orderBy: ORDER,
    include,
    take: FALLING_LIMITS.maxItems,
  });
  return items.map((i) =>
    i.kind === 'TEXT'
      ? { id: i.id, type: 'TEXT', text: i.text, size: i.size }
      : { id: i.id, type: 'IMAGE', url: mediaUrl(i.image), size: i.size },
  );
}
