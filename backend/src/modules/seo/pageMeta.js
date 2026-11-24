// Link önizlemesi (Discord, WhatsApp, Telegram, X…): bu botlar JavaScript çalıştırmaz, yalnızca ilk
// HTML'deki <title>/<meta> etiketlerini okur. SPA'nın index.html'i burada okunur ve sayfa başına
// başlık, açıklama, og:* ve twitter:* etiketleri veritabanındaki içerikten (admin'de ne yazıyorsa)
// doldurularak gönderilir. FRONTEND_DIST tanımlı değilse (geliştirme: Vite) devre dışıdır.
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { getPublicProject } from '../public/projects.js';
import { getPublicSite } from '../public/site.js';

export const DEFAULT_DESCRIPTION =
  'Projeler, duvar kağıtları, canlı durumlar ve iletişim — kişisel portfolyo.';

const PAGE_TITLES = {
  '/wallpapers': 'Duvar kağıtları',
  '/pfps': 'Profil fotoğrafları',
  '/kvkk': 'KVKK aydınlatma metni',
  '/cerez-politikasi': 'Çerez politikası',
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

/** Tek satır, en fazla `max` karakter (önizlemeler uzun metni zaten keser). */
const clip = (text, max = 200) => {
  const flat = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
};

const absolute = (url) => (url ? new URL(url, env.PUBLIC_ORIGIN).toString() : null);

/** Hero profil görseli (video ise poster), yoksa favicon. */
function siteImage(site) {
  const profile = site.hero?.profile;
  const fromProfile = profile?.type === 'VIDEO' ? profile.posterUrl : profile?.url;
  return absolute(fromProfile || site.faviconUrl);
}

/**
 * Bir yol için meta değerleri. Bilinmeyen/yayında olmayan proje → site varsayılanları
 * (proje adı veya taslak içerik sızmaz).
 * @returns {Promise<{ title: string, description: string, image: string|null, imageAlt: string,
 *   siteName: string, url: string, type: string }>}
 */
export async function metaFor(pathname) {
  const site = await getPublicSite();
  const siteName = site.navbarTitle || site.hero?.displayName || 'Portfolyo';
  const base = {
    siteName,
    title: siteName,
    description: clip(site.hero?.tagline) || DEFAULT_DESCRIPTION,
    image: siteImage(site),
    imageAlt: site.hero?.displayName || siteName,
    url: absolute(pathname),
    type: 'website',
  };

  const project = pathname.match(/^\/projects\/([^/]+)\/?$/);
  if (project) {
    try {
      const p = await getPublicProject(decodeURIComponent(project[1]));
      return {
        ...base,
        title: `${p.title} · ${siteName}`,
        description: clip(p.excerpt) || base.description,
        image: absolute(p.images[0]?.url) || base.image,
        imageAlt: p.images[0]?.alt || p.title,
        type: 'article',
      };
    } catch {
      return base;
    }
  }
  const page = PAGE_TITLES[pathname.replace(/\/$/, '')];
  return page ? { ...base, title: `${page} · ${siteName}` } : base;
}

/** <title> ve açıklamanın yerine geçecek etiketler. */
export function renderMetaTags(meta) {
  const e = escapeHtml;
  const tags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}" />`,
    `<link rel="canonical" href="${e(meta.url)}" />`,
    `<meta property="og:type" content="${e(meta.type)}" />`,
    `<meta property="og:site_name" content="${e(meta.siteName)}" />`,
    `<meta property="og:title" content="${e(meta.title)}" />`,
    `<meta property="og:description" content="${e(meta.description)}" />`,
    `<meta property="og:url" content="${e(meta.url)}" />`,
    `<meta property="og:locale" content="tr_TR" />`,
    `<meta name="twitter:card" content="${meta.image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${e(meta.title)}" />`,
    `<meta name="twitter:description" content="${e(meta.description)}" />`,
  ];
  if (meta.image) {
    tags.push(
      `<meta property="og:image" content="${e(meta.image)}" />`,
      `<meta property="og:image:alt" content="${e(meta.imageAlt)}" />`,
      `<meta name="twitter:image" content="${e(meta.image)}" />`,
    );
  }
  return tags.join('\n    ');
}

const TITLE_RE = /<title>[\s\S]*?<\/title>/;
const DESCRIPTION_RE = /<meta\s+name="description"[\s\S]*?\/?>/;

/** index.html şablonuna meta etiketlerini yerleştirir. */
export function injectMeta(html, meta) {
  const tags = renderMetaTags(meta);
  const withoutDescription = html.replace(DESCRIPTION_RE, '');
  return TITLE_RE.test(withoutDescription)
    ? withoutDescription.replace(TITLE_RE, tags)
    : withoutDescription.replace('</head>', `    ${tags}\n  </head>`);
}

// index.html önbelleği: deploy yeni build ürettiğinde (mtime değişince) yeniden okunur.
let template = null;
async function readTemplate(file) {
  const { mtimeMs } = await stat(file);
  if (!template || template.mtimeMs !== mtimeMs) {
    template = { mtimeMs, html: await readFile(file, 'utf8') };
  }
  return template.html;
}

const SKIP = /^\/(api|media)(\/|$)/;

/**
 * SPA HTML'i: GET/HEAD, /api ve /media dışı, dosya uzantısı olmayan yollar. Statik dosyalar
 * (assets, favicon…) reverse proxy tarafından doğrudan sunulur; buraya yalnızca sayfa yolları düşer.
 */
export function seoHtml() {
  return async (req, res, next) => {
    if (!env.FRONTEND_DIST || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    if (SKIP.test(req.path) || path.extname(req.path)) return next();
    const file = path.join(env.FRONTEND_DIST, 'index.html');
    let html;
    try {
      html = await readTemplate(file);
    } catch (err) {
      logger.error({ err, file }, 'index.html okunamadı');
      return next();
    }
    let body = html;
    try {
      body = injectMeta(html, await metaFor(req.path));
    } catch (err) {
      // Meta üretilemese de sayfa açılmalı: şablon olduğu gibi gönderilir.
      logger.warn({ err }, 'Sayfa meta etiketleri üretilemedi');
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(200).send(body);
  };
}
