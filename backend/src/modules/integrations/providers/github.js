// FR-INT-G — GitHub profil snapshot'ı (1 saatte bir) ve istatistik kartı proxy'si (6 sa önbellek).
// SSRF önlemi: host'lar yalnızca env'den; kullanıcı girdisinden yalnızca encode edilmiş `username`.
import { env } from '../../../config/env.js';
import { httpsUrl, IntegrationError, request, requestJson } from '../http.js';

const SERVICE = 'GitHub';
const API = 'https://api.github.com';
const CARD_TTL_MS = 6 * 60 * 60_000;
const CARD_FAIL_TTL_MS = 10 * 60_000;
const MAX_SVG_BYTES = 256 * 1024;

export const github = {
  slug: 'github',
  provider: 'GITHUB',
  staleAfterMs: 2 * 60 * 60_000,
  intervalMs: 60 * 60_000,

  /** @param {{ config: { username?: string } }} ctx */
  async sync({ config }) {
    if (!config?.username) {
      throw new IntegrationError('GitHub kullanıcı adı girilmemiş.', { code: 'NOT_CONFIGURED' });
    }
    const headers = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vasquez-portfolio',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
    const { res, data } = await requestJson(`${API}/users/${encodeURIComponent(config.username)}`, {
      service: SERVICE,
      headers,
      allowStatuses: [404],
    });
    if (res.status === 404) {
      throw new IntegrationError('GitHub kullanıcısı bulunamadı.', { code: 'NOT_FOUND' });
    }
    return {
      avatarUrl: httpsUrl(data.avatar_url),
      login: String(data.login ?? config.username),
      name: data.name ? String(data.name) : null,
      htmlUrl: httpsUrl(data.html_url),
      publicRepos: Number(data.public_repos ?? 0),
      followers: Number(data.followers ?? 0),
    };
  },

  test: (ctx) => github.sync(ctx),
};

// ───────────────────────────── Kart proxy ─────────────────────────────

/** Sabit host + encode edilmiş kullanıcı adı. Kullanıcı girdisiyle host/path oluşturulmaz. */
export function cardUrl(card, theme, username) {
  const dark = theme === 'dark';
  if (card === 'stats') {
    const url = new URL('/api', env.GITHUB_STATS_BASE_URL);
    url.search = new URLSearchParams({
      username,
      show_icons: 'true',
      hide_border: 'true',
      bg_color: '00000000',
      theme: dark ? 'dark' : 'default',
    }).toString();
    return url.toString();
  }
  const url = new URL('/', env.GITHUB_STREAK_BASE_URL);
  url.search = new URLSearchParams({
    user: username,
    hide_border: 'true',
    background: '00000000',
    theme: dark ? 'dark' : 'default',
  }).toString();
  return url.toString();
}

const SIZES = { stats: [467, 195], streak: [495, 195] };

/** Servis hatasında aynı ölçüde nötr yer tutucu (layout bozulmaz). */
export function placeholderSvg(card, theme) {
  const [w, h] = SIZES[card];
  const fg = theme === 'dark' ? '#9a98b0' : '#5b5970';
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="İstatistik şu an alınamıyor">`,
    `<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="12" fill="none" stroke="${fg}" stroke-opacity="0.3"/>`,
    `<text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" font-family="system-ui,sans-serif" font-size="14" fill="${fg}">İstatistik şu an alınamıyor</text>`,
    '</svg>',
  ].join('');
}

const cache = new Map();

export const clearCardCache = () => cache.clear();

/** @returns {Promise<{ svg: string, fallback: boolean }>} */
export async function getCard(card, theme, username, now = Date.now()) {
  const key = `${card}:${theme}:${username.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && hit.until > now) return hit.value;
  let value;
  try {
    const res = await request(cardUrl(card, theme, username), {
      service: 'İstatistik kartı',
      headers: { Accept: 'image/svg+xml', 'User-Agent': 'vasquez-portfolio' },
    });
    const type = res.headers.get('content-type') ?? '';
    const text = await res.text();
    if (!type.includes('svg') || text.length > MAX_SVG_BYTES || !text.includes('<svg')) {
      throw new IntegrationError('Kart servisi SVG döndürmedi.');
    }
    value = { svg: text, fallback: false };
    cache.set(key, { value, until: now + CARD_TTL_MS });
  } catch {
    value = { svg: placeholderSvg(card, theme), fallback: true };
    cache.set(key, { value, until: now + CARD_FAIL_TTL_MS });
  }
  return value;
}
