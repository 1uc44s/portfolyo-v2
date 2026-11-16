// US-25, ROUTES.md §4.10, FR-LNK-06 — linkler: görsel (LINK_IMAGE) + başlık + URL, sıralama,
// görsel değiştirme (eski asset silme kuyruğuna), silme. Public liste: aktif + görseli hazır.
import { NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { deleteAssetsInTx, hooks, ingestUpload, mediaUrl, toAssetDto } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';

const ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }];
const include = { image: true };

export const toAdminDto = (link) => ({
  id: link.id,
  title: link.title,
  url: link.url,
  isActive: link.isActive,
  sortOrder: link.sortOrder,
  createdAt: link.createdAt,
  updatedAt: link.updatedAt,
  image: toAssetDto(link.image),
});

const audit = (action, { adminId, ctx, entityId, metadata }) =>
  writeAudit({ adminId, action, entityType: 'LinkItem', entityId, metadata, ctx });

async function findOr404(id) {
  const link = await prisma.linkItem.findUnique({ where: { id }, include });
  if (!link) throw new NotFoundError('Link bulunamadı.');
  return link;
}

export async function listLinks() {
  return (await prisma.linkItem.findMany({ orderBy: ORDER, include })).map(toAdminDto);
}

export async function createLink(input, file, { adminId, ctx }) {
  const { asset, duplicateOf } = await ingestUpload({ kind: 'LINK_IMAGE', file, adminId, ctx });
  const last = await prisma.linkItem.aggregate({ _max: { sortOrder: true } });
  const link = await prisma.linkItem.create({
    data: {
      title: input.title,
      url: input.url,
      isActive: input.isActive ?? true,
      sortOrder: (last._max.sortOrder ?? -10) + 10,
      imageAssetId: asset.id,
    },
    include,
  });
  invalidateSiteCache();
  await audit('CREATED', { adminId, ctx, entityId: link.id, metadata: { title: link.title } });
  return { link: toAdminDto(link), duplicateOf };
}

export async function updateLink(id, input, { adminId, ctx }) {
  await findOr404(id);
  const link = await prisma.linkItem.update({ where: { id }, data: input, include });
  invalidateSiteCache();
  await audit('UPDATED', { adminId, ctx, entityId: id, metadata: { fields: Object.keys(input) } });
  return toAdminDto(link);
}

export async function replaceImage(id, file, { adminId, ctx }) {
  const current = await findOr404(id);
  const { asset, duplicateOf } = await ingestUpload({ kind: 'LINK_IMAGE', file, adminId, ctx });
  const link = await prisma.$transaction(async (tx) => {
    const updated = await tx.linkItem.update({
      where: { id },
      data: { imageAssetId: asset.id },
      include,
    });
    await deleteAssetsInTx(tx, [current.image], { skipInUse: true });
    return updated;
  });
  hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('IMAGE_REPLACED', { adminId, ctx, entityId: id });
  return { link: toAdminDto(link), duplicateOf };
}

export async function reorderLinks(ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    prisma.linkItem.count({ where: { id: { in: ids } } }),
    prisma.linkItem.count(),
  ]);
  if (matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((linkId, index) =>
      prisma.linkItem.update({ where: { id: linkId }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('REORDERED', { adminId, ctx, metadata: { count: ids.length } });
}

export async function deleteLink(id, { adminId, ctx }) {
  const current = await findOr404(id);
  await prisma.$transaction(async (tx) => {
    await tx.linkItem.delete({ where: { id } });
    await deleteAssetsInTx(tx, [current.image], { skipInUse: true });
  });
  hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('DELETED', { adminId, ctx, entityId: id, metadata: { title: current.title } });
}

/** FR-LNK-06 — public: aktif, görseli hazır, sortOrder ASC, id ASC. */
export async function listPublicLinks() {
  const rows = await prisma.linkItem.findMany({
    where: { isActive: true, image: { processingStatus: 'READY' } },
    orderBy: ORDER,
    select: {
      id: true,
      title: true,
      url: true,
      image: { select: { id: true, thumbnailKey: true, width: true, height: true } },
    },
  });
  return rows.map((l) => ({
    id: l.id,
    title: l.title,
    url: l.url,
    image: {
      url: mediaUrl(l.image),
      thumbUrl: l.image.thumbnailKey ? mediaUrl(l.image, 'thumb') : mediaUrl(l.image),
      width: l.image.width,
      height: l.image.height,
    },
  }));
}
