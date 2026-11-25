// Site Ayarları, Hakkımda ve Hero.
import { ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { deleteAssetsInTx, hooks, ingestUpload, mediaUrl } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';

const FAVICON_SELECT = {
  select: { id: true, processingStatus: true, mimeType: true, width: true, height: true },
};

/** Favicon yalnızca READY ise URL'lenir (public site ile aynı kural). */
export const faviconOf = (favicon) =>
  favicon?.processingStatus === 'READY'
    ? {
        url: mediaUrl(favicon),
        mimeType: favicon.mimeType,
        width: favicon.width,
        height: favicon.height,
      }
    : null;

const toSettings = (site, about) => ({
  navbarTitle: site.navbarTitle,
  faviconUrl: faviconOf(site.favicon)?.url ?? null,
  favicon: faviconOf(site.favicon),
  footerTechs: site.footerTechs ?? [],
  techStackPublished: site.techStackPublished,
  about: { title: about.title, bodyMarkdown: about.bodyMarkdown },
  updatedAt: site.updatedAt,
});

export async function getSettings() {
  const [site, about] = await Promise.all([
    prisma.siteSettings.findUniqueOrThrow({
      where: { id: 1 },
      include: { favicon: FAVICON_SELECT },
    }),
    prisma.aboutContent.findUniqueOrThrow({ where: { id: 1 } }),
  ]);
  return toSettings(site, about);
}

export async function updateSiteSettings(adminId, input, ctx) {
  await prisma.siteSettings.update({ where: { id: 1 }, data: input });
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'SETTINGS_UPDATED',
    entityType: 'SiteSettings',
    metadata: { fields: Object.keys(input) },
    ctx,
  });
  return getSettings();
}

export async function updateAbout(adminId, input, ctx) {
  await prisma.aboutContent.update({ where: { id: 1 }, data: input });
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'ABOUT_UPDATED',
    entityType: 'AboutContent',
    metadata: { length: input.bodyMarkdown.length },
    ctx,
  });
  return getSettings();
}

/**
 * Favicon'u yeni asset ile değiştirir (null = varsayılana dön). Eski favicon başka yerde
 * kullanılmıyorsa aynı transaction'da silinir ve dosyaları silme kuyruğuna yazılır.
 */
async function replaceFavicon(newAssetId) {
  const previousId = await prisma.$transaction(async (tx) => {
    const site = await tx.siteSettings.findUniqueOrThrow({
      where: { id: 1 },
      select: { faviconAssetId: true },
    });
    await tx.siteSettings.update({ where: { id: 1 }, data: { faviconAssetId: newAssetId } });
    const oldId = site.faviconAssetId;
    if (!oldId || oldId === newAssetId) return null;
    const old = await tx.mediaAsset.findUnique({ where: { id: oldId } });
    if (old) await deleteAssetsInTx(tx, [old], { skipInUse: true });
    return oldId;
  });
  invalidateSiteCache();
  if (previousId) hooks.onDeletionQueued();
  return previousId;
}

/** PUT /settings/favicon — FAVICON hattından geçen dosya (ico/png, ≤ 512×512, ≤ 1 MB). */
export async function setFavicon(adminId, file, ctx) {
  const { asset, duplicateOf } = await ingestUpload({ kind: 'FAVICON', file, adminId, ctx });
  const previousId = await replaceFavicon(asset.id);
  await writeAudit({
    adminId,
    action: 'FAVICON_UPDATED',
    entityType: 'SiteSettings',
    metadata: { assetId: asset.id, previousAssetId: previousId },
    ctx,
  });
  return { settings: await getSettings(), duplicateOf };
}

/** DELETE /settings/favicon — varsayılan favicon'a dön. */
export async function clearFavicon(adminId, ctx) {
  const previousId = await replaceFavicon(null);
  await writeAudit({
    adminId,
    action: 'FAVICON_UPDATED',
    entityType: 'SiteSettings',
    metadata: { assetId: null, previousAssetId: previousId },
    ctx,
  });
  return getSettings();
}

const toHero = (hero) => ({
  displayName: hero.displayName,
  tagline: hero.tagline,
  location: hero.location,
  nameEffects: hero.nameEffects,
  gradientFrom: hero.gradientFrom,
  gradientTo: hero.gradientTo,
  profileMode: hero.profileMode,
  fixedProfileMediaId: hero.fixedProfileMediaId,
  updatedAt: hero.updatedAt,
});

/**
 * Hero sabit profil seçenekleri: aktif + READY profil medyası. Önizleme public /media URL'iyle
 * (aktif sahip → public görünür), bu yüzden media:read izni gerekmez.
 */
export async function listProfileOptions() {
  const rows = await prisma.profileMedia.findMany({
    where: { isActive: true, asset: { processingStatus: 'READY' } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      title: true,
      asset: { select: { id: true, mediaType: true, thumbnailKey: true, posterKey: true } },
    },
  });
  return rows.map(({ id, title, asset }) => ({
    id,
    title,
    mediaType: asset.mediaType,
    thumbUrl: mediaUrl(asset, asset.thumbnailKey ? 'thumb' : 'main'),
  }));
}

export async function getHero() {
  return toHero(await prisma.heroSettings.findUniqueOrThrow({ where: { id: 1 } }));
}

export async function updateHero(adminId, input, ctx) {
  if (input.profileMode === 'FIXED') {
    const media = await prisma.profileMedia.findUnique({
      where: { id: input.fixedProfileMediaId },
      select: { isActive: true, asset: { select: { processingStatus: true } } },
    });
    if (!media?.isActive || media.asset.processingStatus !== 'READY') {
      throw new ValidationError([
        {
          path: 'fixedProfileMediaId',
          message: 'Seçilen profil görseli bulunamadı, pasif veya henüz hazır değil.',
        },
      ]);
    }
  }
  const hero = await prisma.heroSettings.update({
    where: { id: 1 },
    data: {
      ...input,
      fixedProfileMediaId: input.profileMode === 'FIXED' ? input.fixedProfileMediaId : null,
    },
  });
  invalidateSiteCache();
  await writeAudit({
    adminId,
    action: 'HERO_UPDATED',
    entityType: 'HeroSettings',
    metadata: { fields: Object.keys(input), nameEffects: input.nameEffects },
    ctx,
  });
  return toHero(hero);
}
