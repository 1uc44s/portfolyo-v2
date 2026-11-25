// Spotify: OAuth Authorization Code (sunucu tarafı), refresh token şifreli DB'de,
// access token bellekte. Şu an çalan her çağrıda; top 3 parça 6 saatte; profil 24 saatte bir.
import { env } from '../../../config/env.js';
import { httpsUrl, IntegrationError, requestJson } from '../http.js';

const SERVICE = 'Spotify';
const ACCOUNTS = 'https://accounts.spotify.com';
const API = 'https://api.spotify.com/v1';
export const SPOTIFY_SCOPES = Object.freeze([
  'user-read-currently-playing',
  'user-read-playback-state',
  'user-top-read',
  'user-read-private',
]);
const TOP_EVERY_MS = 6 * 60 * 60_000;
const PROFILE_EVERY_MS = 24 * 60 * 60_000;

export const redirectUri = () =>
  new URL('/api/admin/integrations/spotify/callback', env.PUBLIC_ORIGIN).toString();

export function authorizeUrl(clientId, state) {
  const url = new URL('/authorize', ACCOUNTS);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES.join(' '),
    redirect_uri: redirectUri(),
    state,
    show_dialog: 'true',
  }).toString();
  return url.toString();
}

const basicAuth = (clientId, clientSecret) =>
  `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;

async function tokenRequest(clientId, clientSecret, params) {
  const { res, data } = await requestJson(`${ACCOUNTS}/api/token`, {
    service: SERVICE,
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
    allowStatuses: [400, 401],
  });
  if (res.status === 400 || res.status === 401) {
    const reason = data?.error === 'invalid_client' ? 'Client ID / Secret hatalı.' : null;
    throw new IntegrationError(reason ?? 'Spotify yetkisi geçersiz; yeniden bağlan.', {
      code: 'AUTH_FAILED',
      status: res.status,
    });
  }
  return data;
}

/** Callback: kodu token'a çevirir. */
export async function exchangeCode({ clientId, clientSecret, code }) {
  const data = await tokenRequest(clientId, clientSecret, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
  });
  if (!data?.refresh_token) {
    throw new IntegrationError('Spotify yenileme anahtarı vermedi.', { code: 'AUTH_FAILED' });
  }
  return {
    refreshToken: String(data.refresh_token),
    scopes: String(data.scope ?? '')
      .split(' ')
      .filter(Boolean),
  };
}

// Access token yalnızca bellekte (refresh token'a göre).
let tokenCache = null;
export const clearSpotifyTokenCache = () => {
  tokenCache = null;
};

async function accessToken({ config, secrets, onSecrets }, now) {
  if (tokenCache && tokenCache.refreshToken === secrets.refreshToken && tokenCache.until > now) {
    return tokenCache.token;
  }
  const data = await tokenRequest(config.clientId, secrets.clientSecret, {
    grant_type: 'refresh_token',
    refresh_token: secrets.refreshToken,
  });
  let refreshToken = secrets.refreshToken;
  if (data.refresh_token && data.refresh_token !== refreshToken) {
    refreshToken = String(data.refresh_token);
    await onSecrets?.({ refreshToken });
  }
  tokenCache = {
    refreshToken,
    token: String(data.access_token),
    until: now + Math.max(60, Number(data.expires_in ?? 3600) - 60) * 1000,
  };
  return tokenCache.token;
}

const imageOf = (images) =>
  Array.isArray(images) && images.length > 0 ? httpsUrl(images[0]?.url) : null;

async function api(path, token, allowStatuses = []) {
  return requestJson(`${API}${path}`, {
    service: SERVICE,
    headers: { Authorization: `Bearer ${token}` },
    allowStatuses,
  });
}

export const PLAYING_POLL_MS = 10_000;
export const PLAYING_IDLE_MS = 60_000;

export function toNowPlaying(data, fetchedAt) {
  const item = data?.item;
  if (!item) return null;
  const isEpisode = item.type === 'episode';
  return {
    isPlaying: Boolean(data.is_playing),
    title: String(item.name ?? ''),
    artists: isEpisode
      ? [String(item.show?.name ?? '')].filter(Boolean)
      : (item.artists ?? []).map((a) => String(a.name)),
    albumArtUrl: imageOf(isEpisode ? item.images : item.album?.images),
    trackUrl: httpsUrl(item.external_urls?.spotify),
    progressMs: Number(data.progress_ms ?? 0),
    durationMs: Number(item.duration_ms ?? 0),
    fetchedAt: new Date(fetchedAt).toISOString(),
  };
}

const toTrack = (t) => ({
  title: String(t.name ?? ''),
  artists: (t.artists ?? []).map((a) => String(a.name)),
  albumArtUrl: imageOf(t.album?.images),
  trackUrl: httpsUrl(t.external_urls?.spotify),
});

export const spotify = {
  slug: 'spotify',
  provider: 'SPOTIFY',
  staleAfterMs: 3 * 60_000,
  intervalMs: 60_000,

  /**
   * (2026-11-16): Spotify'ın anlık bildirimi yok; çalarken 10 sn'de bir sorulur, parça bitmek
   * üzereyse bitişin hemen ardından. Çalmıyorsa 60 sn. SSE akışı yeni snapshot'ı anında iletir.
   */
  nextIntervalMs(snapshot) {
    const np = snapshot?.nowPlaying;
    if (!np?.isPlaying) return PLAYING_IDLE_MS;
    const remaining = np.durationMs - np.progressMs;
    if (remaining > 0 && remaining < PLAYING_POLL_MS) return Math.max(1000, remaining + 1000);
    return PLAYING_POLL_MS;
  },

  /**
   * @param {{ config: any, secrets: any, prev?: any, state?: Record<string, number>,
   *   onSecrets?: (s: object) => Promise<void>, now?: number }} ctx
   */
  async sync(ctx) {
    const { config, secrets, prev = null, state = {}, now = Date.now() } = ctx;
    if (!config?.clientId || !secrets?.clientSecret) {
      throw new IntegrationError('Client ID / Secret girilmemiş.', { code: 'NOT_CONFIGURED' });
    }
    if (!secrets.refreshToken) {
      throw new IntegrationError('Spotify hesabı bağlı değil.', { code: 'NOT_CONNECTED' });
    }
    const token = await accessToken(ctx, now);

    let profile = prev?.profile ?? null;
    if (!profile || !state.profileAt || now - state.profileAt >= PROFILE_EVERY_MS) {
      const { data } = await api('/me', token);
      profile = { displayName: data?.display_name ?? null, avatarUrl: imageOf(data?.images) };
      state.profileAt = now;
    }

    const { data: current } = await api('/me/player/currently-playing', token);
    const nowPlaying = toNowPlaying(current, now);

    let topTracks = prev?.topTracks ?? [];
    if (!state.topAt || now - state.topAt >= TOP_EVERY_MS) {
      const { res, data } = await api('/me/top/tracks?time_range=short_term&limit=3', token, [403]);
      // Scope/politika reddi: alt bölüm gizlenir (boş liste).
      topTracks = res.status === 403 ? [] : (data?.items ?? []).slice(0, 3).map(toTrack);
      state.topAt = now;
    }
    return { profile, nowPlaying, topTracks };
  },

  async test(ctx) {
    return spotify.sync({ ...ctx, prev: null, state: {} });
  },
};
