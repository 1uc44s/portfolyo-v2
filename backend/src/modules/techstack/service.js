// F21 — ROUTES.md §4.13, SRS FR-PUB-04B: Tech Stack (halka düzeni). Çoğaltılabilir bölümler
// (TechStackGroup: "My Tech Stack", "My Security Skill"…): her bölümün kendi başlığı, yayın bayrağı
// ve öğeleri (TechStackItem: etiket, açıklama, opsiyonel daire görseli, sıra = numara) vardır.
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
  groupId: item.groupId,
  label: item.label,
  description: item.description,
  isActive: item.isActive,
  sortOrder: item.sortOrder,
  image: item.image ? toAssetDto(item.image) : null,
});

const titleOf = (group) => ({
  top: group.titleTop,
  main: group.titleMain,
  bottom: group.titleBottom,
});

/** "My Security Skill" gibi tek satırlık ad (audit, mesajlar). */
const nameOf = (group) =>
  [group.titleTop, group.titleMain, group.titleBottom].filter(Boolean).join(' ');

const toGroupDto = (group) => ({
  id: group.id,
  published: group.published,
  sortOrder: group.sortOrder,
  title: titleOf(group),
  items: (group.items ?? []).map(toItemDto),
});

const withItems = { items: { orderBy: ORDER, include } };

// ───────────────────────────── Bölümler ─────────────────────────────

export async function getTechStack() {
  const groups = await prisma.techStackGroup.findMany({ orderBy: ORDER, include: withItems });
  return { groups: groups.map(toGroupDto), limits: TECH_STACK_LIMITS };
}

async function findGroupOr404(id) {
  const group = await prisma.techStackGroup.findUnique({ where: { id }, include: withItems });
  if (!group) throw new NotFoundError('Bölüm bulunamadı.');
  return group;
}

export async function createGroup(input, { adminId, ctx }) {
  if ((await prisma.techStackGroup.count()) >= TECH_STACK_LIMITS.maxGroups) {
    throw new AppError(
      409,
      'LIMIT_REACHED',
      `En fazla ${TECH_STACK_LIMITS.maxGroups} bölüm eklenebilir.`,
    );
  }
  const last = await prisma.techStackGroup.aggregate({ _max: { sortOrder: true } });
  const group = await prisma.techStackGroup.create({
    data: {
      titleTop: input.titleTop,
      titleMain: input.titleMain,
      titleBottom: input.titleBottom,
      published: false,
      sortOrder: (last._max.sortOrder ?? -10) + 10,
    },
    include: withItems,
  });
  await audit('TECH_STACK_GROUP_CREATED', {
    adminId,
    ctx,
    entityId: group.id,
    metadata: { title: nameOf(group) },
  });
  return toGroupDto(group);
}

export async function updateGroup(id, input, { adminId, ctx }) {
  await findGroupOr404(id);
  if (input.published) {
    const active = await prisma.techStackItem.count({ where: { groupId: id, isActive: true } });
    if (active < TECH_STACK_LIMITS.minItems) {
      throw new ValidationError([
        {
          path: 'published',
          message: `Yayınlamak için bu bölümde en az ${TECH_STACK_LIMITS.minItems} aktif öğe gerekli.`,
        },
      ]);
    }
  }
  const group = await prisma.techStackGroup.update({
    where: { id },
    data: {
      published: input.published,
      titleTop: input.titleTop,
      titleMain: input.titleMain,
      titleBottom: input.titleBottom,
    },
    include: withItems,
  });
  invalidateSiteCache();
  await audit('TECH_STACK_GROUP_UPDATED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { published: input.published },
  });
  return toGroupDto(group);
}

export async function reorderGroups(ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    prisma.techStackGroup.count({ where: { id: { in: ids } } }),
    prisma.techStackGroup.count(),
  ]);
  if (matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((groupId, index) =>
      prisma.techStackGroup.update({ where: { id: groupId }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('REORDERED', {
    adminId,
    ctx,
    metadata: { entity: 'TechStackGroup', count: ids.length },
  });
}

/** Bölüm, öğeleri ve öğe görselleriyle birlikte silinir (görseller silme kuyruğuna). */
export async function deleteGroup(id, { adminId, ctx }) {
  const group = await findGroupOr404(id);
  const images = group.items.map((i) => i.image).filter(Boolean);
  await prisma.$transaction(async (tx) => {
    await tx.techStackItem.deleteMany({ where: { groupId: id } });
    await tx.techStackGroup.delete({ where: { id } });
    if (images.length) await deleteAssetsInTx(tx, images, { skipInUse: true });
  });
  if (images.length) hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('TECH_STACK_GROUP_DELETED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { title: nameOf(group), items: group.items.length },
  });
}

// ───────────────────────────── Öğeler ─────────────────────────────

async function findOr404(id) {
  const item = await prisma.techStackItem.findUnique({ where: { id }, include });
  if (!item) throw new NotFoundError('Öğe bulunamadı.');
  return item;
}

export async function createItem(groupId, input, file, { adminId, ctx }) {
  await findGroupOr404(groupId);
  if ((await prisma.techStackItem.count({ where: { groupId } })) >= TECH_STACK_LIMITS.maxItems) {
    throw new AppError(
      409,
      'LIMIT_REACHED',
      `Bir bölüme en fazla ${TECH_STACK_LIMITS.maxItems} öğe eklenebilir.`,
    );
  }
  let asset = null;
  let duplicateOf = null;
  if (file) ({ asset, duplicateOf } = await ingestUpload({ kind: KIND, file, adminId, ctx }));
  const last = await prisma.techStackItem.aggregate({
    where: { groupId },
    _max: { sortOrder: true },
  });
  const item = await prisma.techStackItem.create({
    data: {
      groupId,
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
    metadata: { title: item.label, groupId },
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

/** Bir bölümün öğe sırası; liste o bölümün öğelerinin tamamı olmalı. */
export async function reorderItems(groupId, ids, { adminId, ctx }) {
  await findGroupOr404(groupId);
  const [matching, total] = await Promise.all([
    prisma.techStackItem.count({ where: { groupId, id: { in: ids } } }),
    prisma.techStackItem.count({ where: { groupId } }),
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
  await audit('REORDERED', {
    adminId,
    ctx,
    metadata: { entity: 'TechStack', groupId, count: ids.length },
  });
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
    metadata: { title: current.label, groupId: current.groupId },
  });
}

// ───────────────────────────── Public ─────────────────────────────

const publicImage = (asset) =>
  asset?.processingStatus === 'READY'
    ? { url: mediaUrl(asset), width: asset.width, height: asset.height }
    : null;

/** Herhangi bir bölüm yayında mı (site iskeleti için hafif sorgu)? */
export const hasPublishedTechStack = async () =>
  (await prisma.techStackGroup.count({ where: { published: true } })) > 0;

/**
 * FR-PUB-04B — public: yalnızca yayındaki bölümler ve aktif öğeleri (sırayla). Yayında olmayan
 * bölümün başlığı/öğeleri sızmaz. Aktif öğesi kalmamış bölüm listeye girmez.
 */
export async function getPublicTechStack() {
  const groups = await prisma.techStackGroup.findMany({
    where: { published: true },
    orderBy: ORDER,
    include: {
      items: {
        where: { isActive: true },
        orderBy: ORDER,
        include,
        take: TECH_STACK_LIMITS.maxItems,
      },
    },
  });
  const visible = groups.filter((g) => g.items.length > 0);
  return {
    published: visible.length > 0,
    groups: visible.map((g) => ({
      id: g.id,
      title: titleOf(g),
      items: g.items.map((i) => ({
        id: i.id,
        label: i.label,
        description: i.description,
        image: publicImage(i.image),
      })),
    })),
  };
}
