// ROUTES.md §3.1, NFR-PERF-04 — public sayfa iskeleti için tek aggregate yanıt.
// 30 sn bellek önbelleği; ilgili admin yazımında invalidateSiteCache() çağrılır.
// Henüz yapılmamış fazların alanları null/false döner.
import { prisma } from '../../lib/prisma.js';
import { publicCaptchaConfig } from '../../lib/turnstile.js';
import { istanbulDate } from '../../lib/time.js';
import { resolveToday } from '../rotation/service.js';
import { listPublicFalling } from '../falling/service.js';
import { mediaUrl } from '../media/service.js';
import { DOWNLOADABLE_WHERE, WALLPAPER_WHERE } from './visibility.js';

const CACHE_TTL_MS = 30_000;
let cached = null;

export const invalidateSiteCache = () => {
  cached = null;
};

const exists = async (delegate, where) =>
  Boolean(await delegate.findFirst({ where, select: { id: true } }));

const visual = (asset) => ({
  type: asset.mediaType,
  url: mediaUrl(asset),
  posterUrl: asset.posterKey ? mediaUrl(asset, 'poster') : null,
  // FR-MED-06b: ekrana göre oynatma kopyaları (küçükten büyüğe); ana kopya en büyük ekranlar için.
  ...(asset.metadata?.variants && {
    sources: [
      asset.metadata.variants.v720 && { url: mediaUrl(asset, 'v720'), maxWidth: 900 },
      asset.metadata.variants.v1080 && { url: mediaUrl(asset, 'v1080'), maxWidth: 2400 },
    ].filter(Boolean),
  }),
});

/** Hero sabit profil görseli (FIXED). */
async function fixedProfile(hero) {
  if (hero?.profileMode !== 'FIXED' || !hero.fixedProfileMediaId) return null;
  const media = await prisma.profileMedia.findFirst({
    where: { id: hero.fixedProfileMediaId, isActive: true, asset: { processingStatus: 'READY' } },
    select: { asset: { select: { id: true, mediaType: true, posterKey: true } } },
  });
  return media ? visual(media.asset) : null;
}

/** ROUTES.md §3.1 `today` — FR-ROT-07 çözümlemesi (override → otomatik → null). */
async function buildToday() {
  const [background, music, pfp, cursor, nameOverlay] = await Promise.all(
    ['BACKGROUND', 'MUSIC', 'PFP', 'CURSOR', 'NAME_OVERLAY'].map((c) => resolveToday(c)),
  );
  return {
    date: istanbulDate(),
    background: background && { ...visual(background.record.asset), source: background.source },
    music: music && {
      title: music.record.title,
      artist: music.record.artist,
      audioUrl: mediaUrl(music.record.audio),
      coverUrl: mediaUrl(music.record.cover),
      durationMs: music.record.durationMs,
      source: music.source,
    },
    cursor: cursor && {
      normal: {
        url: mediaUrl(cursor.record.normal),
        hotspot: [cursor.record.normalHotspotX, cursor.record.normalHotspotY],
      },
      click: {
        url: mediaUrl(cursor.record.click),
        hotspot: [cursor.record.clickHotspotX, cursor.record.clickHotspotY],
      },
      source: cursor.source,
    },
    pfp: pfp && { ...visual(pfp.record.asset), source: pfp.source },
    nameOverlay: nameOverlay && {
      url: mediaUrl(nameOverlay.record.asset),
      source: nameOverlay.source,
    },
  };
}

async function buildSite() {
  const [site, hero, about, integrations, cookiePolicy] = await Promise.all([
    prisma.siteSettings.findUnique({
      where: { id: 1 },
      include: { favicon: { select: { id: true, processingStatus: true } } },
    }),
    prisma.heroSettings.findUnique({ where: { id: 1 } }),
    prisma.aboutContent.findUnique({ where: { id: 1 } }),
    prisma.integrationSetting.findMany({ select: { provider: true, isEnabled: true } }),
    prisma.legalDocument.findUnique({ where: { key: 'COOKIE_POLICY' }, select: { version: true } }),
  ]);
  const [wallpapers, pfps, projects, links, profile] = await Promise.all([
    exists(prisma.background, WALLPAPER_WHERE),
    exists(prisma.profileMedia, DOWNLOADABLE_WHERE),
    exists(prisma.project, { isPublished: true }),
    exists(prisma.linkItem, { isActive: true, image: { processingStatus: 'READY' } }),
    fixedProfile(hero),
  ]);
  const { pfp, ...today } = await buildToday();
  // FR-HERO-02: ROTATION modunda günün profil fotoğrafı; FIXED modunda sabit görsel.
  const heroProfile =
    hero?.profileMode === 'FIXED'
      ? profile
      : pfp && { type: pfp.type, url: pfp.url, posterUrl: pfp.posterUrl };
  const enabled = (provider) => integrations.some((i) => i.provider === provider && i.isEnabled);
  const navbarTitle = site?.navbarTitle ?? 'vasquez';
  const displayName = hero?.displayName || navbarTitle;
  const aboutBody = about?.bodyMarkdown?.trim() ?? '';

  return {
    navbarTitle,
    faviconUrl: site?.favicon?.processingStatus === 'READY' ? mediaUrl(site.favicon) : null,
    nav: { wallpapers, pfps },
    hero: {
      displayName,
      tagline: hero?.tagline ?? null,
      location: hero?.location ?? null,
      nameEffects: hero?.nameEffects ?? [],
      gradientFrom: hero?.gradientFrom ?? '#a78bfa',
      gradientTo: hero?.gradientTo ?? '#f472b6',
      profile: heroProfile,
    },
    today,
    falling: await listPublicFalling(),
    about: aboutBody ? { title: about.title, bodyMarkdown: about.bodyMarkdown } : null,
    footer: { techs: site?.footerTechs ?? [], ownerName: displayName },
    techStack: { published: site?.techStackPublished ?? false },
    integrations: {
      discord: enabled('DISCORD'),
      spotify: enabled('SPOTIFY'),
      github: enabled('GITHUB'),
    },
    sections: { projects, links, about: Boolean(aboutBody) },
    legal: { cookiePolicyVersion: cookiePolicy?.version ?? 1 },
    captcha: publicCaptchaConfig(),
  };
}

export async function getPublicSite() {
  if (cached && cached.until > Date.now()) return cached.value;
  const value = await buildSite();
  cached = { value, until: Date.now() + CACHE_TTL_MS };
  return value;
}
