// F21 — ROUTES.md §4.13, SRS FR-PUB-04B: Tech Stack (halka düzeni). Başlık SiteSettings'te,
// öğeler TechStackItem'da (etiket, açıklama, opsiyonel daire görseli, sıra = numara).
import { TECH_STACK_LIMITS } from '@vasquez/shared';
import { AppError, NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { deleteAssetsInTx, hooks, ingestUpload, mediaUrl, toAssetDto } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';

const KIND = 'TECH_STACK_IMAGE';
const ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }];
const include = { image: true };

const audit = (action, { adminId, ctx, entityId, metadata }) =>
  writeAudit({ adminId, action, entityType: 'TechStack', entityId, metadata, ctx });

const toItemDto = (item) => ({
  id: item.id,
  label: item.label,
  description: item.description,
  isActive: item.isActive,
  sortOrder: item.sortOrder,
  image: item.image ? toAssetDto(item.image) : null,
});

const siteRow = () => prisma.siteSettings.findUniqueOrThrow({ where: { id: 1 } });

export async function getTechStack() {
  const [site, items] = await Promise.all([
    siteRow(),
    prisma.techStackItem.findMany({ orderBy: ORDER, include }),
  ]);
  return {
    published: site.techStackPublished,
    title: {
      top: site.techStackTitleTop,
      main: site.techStackTitleMain,
      bottom: site.techStackTitleBottom,
    },
    items: items.map(toItemDto),
    limits: TECH_STACK_LIMITS,
  };
}

export async function updateSettings(input, { adminId, ctx }) {
  if (input.published) {
    const active = await prisma.techStackItem.count({ where: { isActive: true } });
    if (active < TECH_STACK_LIMITS.minItems) {
      throw new ValidationError([
        {
          path: 'published',
          message: `Yayınlamak için en az ${TECH_STACK_LIMITS.minItems} aktif öğe gerekli.`,
        },
      ]);
    }
  }
  await prisma.siteSettings.update({
    where: { id: 1 },
    data: {
      techStackPublished: input.published,
      techStackTitleTop: input.titleTop,
      techStackTitleMain: input.titleMain,
      techStackTitleBottom: input.titleBottom,
    },
  });
  invalidateSiteCache();
  await audit('TECH_STACK_TOGGLED', { adminId, ctx, metadata: { published: input.published } });
  return getTechStack();
}

async function findOr404(id) {
  const item = await prisma.techStackItem.findUnique({ where: { id }, include });
  if (!item) throw new NotFoundError('Öğe bulunamadı.');
  return item;
}

export async function createItem(input, file, { adminId, ctx }) {
  if ((await prisma.techStackItem.count()) >= TECH_STACK_LIMITS.maxItems) {
    throw new AppError(
      409,
      'LIMIT_REACHED',
      `En fazla ${TECH_STACK_LIMITS.maxItems} öğe eklenebilir.`,
    );
  }
  let asset = null;
  let duplicateOf = null;
  if (file) ({ asset, duplicateOf } = await ingestUpload({ kind: KIND, file, adminId, ctx }));
  const last = await prisma.techStackItem.aggregate({ _max: { sortOrder: true } });
  const item = await prisma.techStackItem.create({
    data: {
      label: input.label,
      description: input.description ?? '',
      isActive: input.isActive ?? true,
      sortOrder: (last._max.sortOrder ?? -10) + 10,
      imageAssetId: asset?.id ?? null,
    },
    include,
  });
  invalidateSiteCache();
  await audit('TECH_STACK_ITEM_CREATED', {
    adminId,
    ctx,
    entityId: item.id,
    metadata: { title: item.label },
  });
  return { item: toItemDto(item), duplicateOf };
}

export async function updateItem(id, input, { adminId, ctx }) {
  await findOr404(id);
  const item = await prisma.techStackItem.update({ where: { id }, data: input, include });
  invalidateSiteCache();
  await audit('TECH_STACK_ITEM_UPDATED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { fields: Object.keys(input) },
  });
  return toItemDto(item);
}

/** Görsel değiştir (file) ya da kaldır (null). Eski asset silme kuyruğuna. */
export async function replaceItemImage(id, file, { adminId, ctx }) {
  const current = await findOr404(id);
  let asset = null;
  let duplicateOf = null;
  if (file) ({ asset, duplicateOf } = await ingestUpload({ kind: KIND, file, adminId, ctx }));
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.techStackItem.update({
      where: { id },
      data: { imageAssetId: asset?.id ?? null },
      include,
    });
    if (current.image) await deleteAssetsInTx(tx, [current.image], { skipInUse: true });
    return updated;
  });
  if (current.image) hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('TECH_STACK_ITEM_UPDATED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { image: Boolean(asset) },
  });
  return { item: toItemDto(item), duplicateOf };
}

export async function reorderItems(ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    prisma.techStackItem.count({ where: { id: { in: ids } } }),
    prisma.techStackItem.count(),
  ]);
  if (matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((itemId, index) =>
      prisma.techStackItem.update({ where: { id: itemId }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('REORDERED', { adminId, ctx, metadata: { entity: 'TechStack', count: ids.length } });
}

export async function deleteItem(id, { adminId, ctx }) {
  const current = await findOr404(id);
  await prisma.$transaction(async (tx) => {
    await tx.techStackItem.delete({ where: { id } });
    if (current.image) await deleteAssetsInTx(tx, [current.image], { skipInUse: true });
  });
  if (current.image) hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('TECH_STACK_ITEM_DELETED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { title: current.label },
  });
}

const publicImage = (asset) =>
  asset?.processingStatus === 'READY'
    ? { url: mediaUrl(asset), width: asset.width, height: asset.height }
    : null;

/** FR-PUB-04B — public: yayında değilse yalnızca bayrak (öğe/metin sızmaz). */
export async function getPublicTechStack() {
  const site = await siteRow();
  if (!site.techStackPublished) return { published: false };
  const items = await prisma.techStackItem.findMany({
    where: { isActive: true },
    orderBy: ORDER,
    include,
    take: TECH_STACK_LIMITS.maxItems,
  });
  return {
    published: true,
    title: {
      top: site.techStackTitleTop,
      main: site.techStackTitleMain,
      bottom: site.techStackTitleBottom,
    },
    items: items.map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description,
      image: publicImage(i.image),
    })),
  };
}
