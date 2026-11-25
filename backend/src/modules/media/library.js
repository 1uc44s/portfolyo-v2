// Medya kütüphanesi uçları, "kullanımdaki medya" kontrolü ve public görünürlük kuralı.
import { AppError, NotFoundError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { ORPHAN_WHERE, deleteAssetsInTx, hooks, toAssetDto } from './service.js';

const titled = { select: { id: true, title: true, isActive: true } };

/** Sahip ilişkileri: kullanım listesi ve public görünürlük için. */
export const OWNER_INCLUDE = {
  background: titled,
  musicAudio: titled,
  musicCover: titled,
  profileMedia: titled,
  cursorNormal: titled,
  cursorClick: titled,
  projectImage: {
    select: { id: true, project: { select: { id: true, title: true, isPublished: true } } },
  },
  linkItem: titled,
  faviconOf: { select: { id: true } },
  techStackItem: {
    select: { id: true, label: true, isActive: true, group: { select: { published: true } } },
  },
  nameOverlay: titled,
  fallingItem: { select: { id: true, kind: true, isActive: true } },
};

/** Asset'i kullanan kayıtlar: [{ type, id, title }]. */
export function usageOf(asset) {
  const usage = [];
  const push = (type, owner) => owner && usage.push({ type, id: owner.id, title: owner.title });
  push('BACKGROUND', asset.background);
  push('MUSIC', asset.musicAudio);
  push('MUSIC', asset.musicCover);
  push('PROFILE_MEDIA', asset.profileMedia);
  push('CURSOR_SET', asset.cursorNormal);
  push('CURSOR_SET', asset.cursorClick);
  push('LINK', asset.linkItem);
  push('NAME_OVERLAY', asset.nameOverlay);
  if (asset.fallingItem) {
    usage.push({ type: 'FALLING_ITEM', id: asset.fallingItem.id, title: 'Yağan öğe' });
  }
  if (asset.projectImage) push('PROJECT', asset.projectImage.project);
  if (asset.faviconOf?.length) usage.push({ type: 'FAVICON', id: 1, title: 'Site favicon' });
  if (asset.techStackItem) {
    usage.push({
      type: 'TECH_STACK',
      id: asset.techStackItem.id,
      title: asset.techStackItem.label,
    });
  }
  return usage;
}

/** Public sunum şartı: READY + public-görünür en az bir sahip (pasif içerik → 404). */
export function isPubliclyVisible(asset) {
  if (asset.processingStatus !== 'READY') return false;
  const owners = [
    asset.background,
    asset.musicAudio,
    asset.musicCover,
    asset.profileMedia,
    asset.cursorNormal,
    asset.cursorClick,
    asset.linkItem,
    asset.nameOverlay,
    asset.fallingItem,
  ];
  if (owners.some((o) => o?.isActive)) return true;
  if (asset.projectImage?.project?.isPublished) return true;
  // Tech Stack: öğenin bölümü yayındaysa aktif öğe görseli.
  if (asset.techStackItem?.isActive && asset.techStackItem.group?.published) return true;
  return (asset.faviconOf?.length ?? 0) > 0;
}

// Not: çoklu ilişki include'u interaktif transaction içinde kullanılmaz (adapter-pg paralel
// sorgu uyarısı); silmede koşullu deleteMany yeterli atomiklik sağlar.
export async function findAssetWithOwners(id) {
  // öğe görseli yalnızca öğenin Tech Stack bölümü yayındaysa public (OWNER_INCLUDE.group).
  return prisma.mediaAsset.findUnique({ where: { id }, include: OWNER_INCLUDE });
}

/** @param {{ kind?: string, status?: string, orphan?: boolean, limit: number, cursor?: string }} query */
export async function listAssets({ kind, status, orphan, limit, cursor }) {
  const where = {
    ...(kind && { kind }),
    ...(status && { processingStatus: status }),
    ...(orphan && ORPHAN_WHERE),
  };
  const rows = await prisma.mediaAsset.findMany({
    where,
    include: OWNER_INCLUDE,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
  const page = rows.slice(0, limit);
  return {
    items: page.map((a) => ({ ...toAssetDto(a), usage: usageOf(a) })),
    nextCursor: rows.length > limit ? page.at(-1).id : null,
  };
}

export async function getAsset(id) {
  const asset = await findAssetWithOwners(id);
  if (!asset) throw new NotFoundError('Medya bulunamadı.');
  return {
    ...toAssetDto(asset),
    sha256: asset.sha256,
    metadata: asset.metadata,
    usage: usageOf(asset),
  };
}

/** yalnızca yetim asset silinir; kullanımdaysa 409 IN_USE + kullanan kayıtlar. */
export async function deleteOrphanAsset(id, adminId, ctx) {
  const asset = await findAssetWithOwners(id);
  if (!asset) throw new NotFoundError('Medya bulunamadı.');
  const usage = usageOf(asset);
  if (usage.length > 0) {
    throw new AppError(409, 'IN_USE', 'Bu medya kullanımda; önce kullanan kaydı sil.', {
      details: { usage },
    });
  }
  await prisma.$transaction((tx) => deleteAssetsInTx(tx, [asset]));
  hooks.onDeletionQueued();
  await writeAudit({
    adminId,
    action: 'MEDIA_DELETED',
    entityType: 'MediaAsset',
    entityId: id,
    ctx,
  });
}

/** Tür bazında adet ve bayt (depolama özeti). */
export async function storageSummary() {
  const groups = await prisma.mediaAsset.groupBy({
    by: ['kind'],
    _count: { _all: true },
    _sum: { totalBytes: true },
  });
  const byKind = groups.map((g) => ({
    kind: g.kind,
    count: g._count._all,
    totalBytes: g._sum.totalBytes ?? 0,
  }));
  return {
    byKind,
    totalBytes: byKind.reduce((sum, g) => sum + g.totalBytes, 0),
    pendingDeletions: await prisma.storageDeletionJob.count({ where: { processedAt: null } }),
  };
}
