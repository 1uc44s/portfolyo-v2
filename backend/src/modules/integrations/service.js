// entegrasyon ayarları, secret'lar (AES-GCM), senkron,
// public snapshot okuma. Ziyaretçi isteği hiçbir zaman dış API çağrısı tetiklemez.
import {
  INTEGRATION_CONFIG_SCHEMAS,
  INTEGRATION_SECRET_KEYS,
  INTEGRATION_SECRET_SCHEMAS,
  SLUG_TO_PROVIDER,
} from '@my-portfolyo/shared';
import { decryptJson, encryptJson } from '../../lib/crypto.js';
import { NotFoundError, ValidationError } from '../../lib/httpError.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { invalidateSiteCache } from '../public/site.js';
import { IntegrationError, publicErrorMessage } from './http.js';
import { emitStatusChange } from './live.js';
import { discord } from './providers/discord.js';
import { github } from './providers/github.js';
import { redirectUri, SPOTIFY_SCOPES, spotify } from './providers/spotify.js';

export const PROVIDERS = Object.freeze({ discord, spotify, github });

/** Ayar değişince işçi yeniden başlar (scheduler bağlar). */
export const hooks = { onChanged: (_slug) => {} };

const providerOf = (slug) => {
  const p = PROVIDERS[slug];
  if (!p) throw new NotFoundError('Entegrasyon bulunamadı.');
  return p;
};

export async function getRow(slug) {
  const provider = SLUG_TO_PROVIDER[slug];
  return prisma.integrationSetting.upsert({
    where: { provider },
    create: { provider },
    update: {},
  });
}

export function readSecrets(row) {
  if (!row?.secretsEnc) return {};
  try {
    return decryptJson(row.secretsEnc);
  } catch (err) {
    logger.error({ err: err?.message, provider: row.provider }, 'Entegrasyon secret çözülemedi');
    return {};
  }
}

const toAdminDto = (slug, row) => {
  const secrets = readSecrets(row);
  const dto = {
    provider: slug,
    isEnabled: row.isEnabled,
    config: row.config ?? {},
    secrets: Object.fromEntries(
      INTEGRATION_SECRET_KEYS[slug].map((k) => [k, { isSet: Boolean(secrets[k]) }]),
    ),
    status: row.status,
    lastSyncAt: row.lastSyncAt,
    lastSuccessAt: row.lastSuccessAt,
    lastError: row.lastError,
    snapshotAt: row.snapshotAt,
    snapshot: row.publicSnapshot ?? null,
  };
  if (slug === 'spotify') {
    dto.spotify = {
      redirectUri: redirectUri(),
      connected: Boolean(secrets.refreshToken),
      requestedScopes: SPOTIFY_SCOPES,
      grantedScopes: Array.isArray(row.config?.grantedScopes) ? row.config.grantedScopes : [],
    };
  }
  return dto;
};

export async function listIntegrations() {
  const out = [];
  for (const slug of Object.keys(PROVIDERS)) out.push(toAdminDto(slug, await getRow(slug)));
  return out;
}

const audit = (action, { adminId, ctx, slug, metadata }) =>
  writeAudit({ adminId, action, entityType: 'IntegrationSetting', entityId: slug, metadata, ctx });

export async function updateIntegration(slug, input, { adminId, ctx }) {
  providerOf(slug);
  const row = await getRow(slug);
  const data = {};
  if (input.config !== undefined) {
    // Kısmi güncelleme: gönderilmeyen alanlar korunur; birleşik sonuç tam şemayla doğrulanır.
    const { grantedScopes: _server, ...current } = row.config ?? {};
    const parsed = INTEGRATION_CONFIG_SCHEMAS[slug].safeParse({ ...current, ...input.config });
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((i) => ({
          path: ['config', ...i.path].join('.'),
          message: i.message,
        })),
      );
    }
    // Sunucunun yazdığı alanlar (ör. grantedScopes) korunur.
    const kept = slug === 'spotify' ? { grantedScopes: row.config?.grantedScopes ?? [] } : {};
    data.config = { ...kept, ...parsed.data };
  }
  if (input.isEnabled !== undefined) {
    data.isEnabled = input.isEnabled;
    if (!input.isEnabled) data.status = 'DISCONNECTED';
  }
  const updated = await prisma.integrationSetting.update({ where: { id: row.id }, data });
  invalidateSiteCache();
  emitStatusChange(slug);
  await audit('INTEGRATION_UPDATED', {
    adminId,
    ctx,
    slug,
    metadata: { fields: Object.keys(data), isEnabled: updated.isEnabled },
  });
  hooks.onChanged(slug);
  return toAdminDto(slug, updated);
}

/** L5 — secret'lar birleştirilerek şifrelenir; yanıtta değer dönmez. */
export async function setSecrets(slug, input, { adminId, ctx }) {
  providerOf(slug);
  const schema = INTEGRATION_SECRET_SCHEMAS[slug];
  if (!schema)
    throw new ValidationError([{ path: 'secrets', message: 'Bu entegrasyonun secret alanı yok.' }]);
  const parsed = schema.parse(input);
  const row = await getRow(slug);
  const secrets = { ...readSecrets(row), ...parsed };
  const updated = await prisma.integrationSetting.update({
    where: { id: row.id },
    data: { secretsEnc: encryptJson(secrets) },
  });
  await audit('INTEGRATION_SECRET_UPDATED', {
    adminId,
    ctx,
    slug,
    metadata: { fields: Object.keys(parsed) },
  });
  hooks.onChanged(slug);
  return toAdminDto(slug, updated);
}

/** Sunucunun kendi yazdığı secret'lar (ör. Spotify refresh token). */
export async function mergeSecrets(slug, partial) {
  const row = await getRow(slug);
  const next = { ...readSecrets(row), ...partial };
  for (const [k, v] of Object.entries(partial)) if (v == null) delete next[k];
  await prisma.integrationSetting.update({
    where: { id: row.id },
    data: { secretsEnc: Object.keys(next).length ? encryptJson(next) : null },
  });
}

export async function recordSuccess(slug, snapshot, now = new Date()) {
  const row = await getRow(slug);
  await prisma.integrationSetting.update({
    where: { id: row.id },
    data: {
      status: 'CONNECTED',
      lastSyncAt: now,
      lastSuccessAt: now,
      lastError: null,
      publicSnapshot: snapshot,
      snapshotAt: now,
    },
  });
  emitStatusChange(slug); // açık sayfalara canlı gönder
}

export async function recordFailure(slug, err, now = new Date()) {
  const row = await getRow(slug);
  await prisma.integrationSetting.update({
    where: { id: row.id },
    data: { status: 'ERROR', lastSyncAt: now, lastError: publicErrorMessage(err) },
  });
}

/** Sağlayıcı bağlamı: config + çözülmüş secret'lar + önceki snapshot. */
export async function contextOf(slug, extra = {}) {
  const row = await getRow(slug);
  return {
    row,
    config: row.config ?? {},
    secrets: readSecrets(row),
    prev: row.publicSnapshot ?? null,
    onSecrets: (partial) => mergeSecrets(slug, partial),
    ...extra,
  };
}

/** Admin "Şimdi senkronize et" ve işçi turu. Hata kaydedilir ve yeniden fırlatılır. */
export async function syncNow(slug, extra = {}) {
  const provider = providerOf(slug);
  const ctx = await contextOf(slug, extra);
  try {
    const snapshot = await provider.sync(ctx);
    await recordSuccess(slug, snapshot);
    return snapshot;
  } catch (err) {
    const safe =
      err instanceof IntegrationError ? err : new IntegrationError(publicErrorMessage(err));
    if (!(err instanceof IntegrationError)) {
      logger.error({ err: err?.message, provider: slug }, 'Entegrasyon senkronu beklenmedik hata');
    }
    await recordFailure(slug, safe);
    throw safe;
  }
}

/** senkron test; sonucu döndürür, lastError'u günceller (snapshot yazmaz). */
export async function testIntegration(slug, { adminId, ctx: reqCtx }) {
  const provider = providerOf(slug);
  const ctx = await contextOf(slug);
  let result;
  try {
    await provider.test(ctx);
    await prisma.integrationSetting.update({
      where: { id: ctx.row.id },
      data: { lastError: null, lastSyncAt: new Date() },
    });
    result = { ok: true, message: 'Bağlantı başarılı.' };
  } catch (err) {
    const message = publicErrorMessage(err);
    await prisma.integrationSetting.update({
      where: { id: ctx.row.id },
      data: { lastError: message, lastSyncAt: new Date(), status: 'ERROR' },
    });
    result = { ok: false, message };
  }
  await audit('INTEGRATION_TESTED', { adminId, ctx: reqCtx, slug, metadata: { ok: result.ok } });
  return result;
}

export async function disconnectSpotify({ adminId, ctx }) {
  await mergeSecrets('spotify', { refreshToken: null });
  const row = await getRow('spotify');
  await prisma.integrationSetting.update({
    where: { id: row.id },
    data: {
      status: 'DISCONNECTED',
      publicSnapshot: null,
      snapshotAt: null,
      config: { ...(row.config ?? {}), grantedScopes: [] },
    },
  });
  await audit('INTEGRATION_DISCONNECTED', { adminId, ctx, slug: 'spotify' });
  hooks.onChanged('spotify');
}

export async function saveSpotifyConnection({ refreshToken, scopes }, { adminId, ctx }) {
  await mergeSecrets('spotify', { refreshToken });
  const row = await getRow('spotify');
  await prisma.integrationSetting.update({
    where: { id: row.id },
    data: { config: { ...(row.config ?? {}), grantedScopes: scopes }, lastError: null },
  });
  await audit('INTEGRATION_CONNECTED', { adminId, ctx, slug: 'spotify', metadata: { scopes } });
  hooks.onChanged('spotify');
}

// ───────────────────────────── Public ─────────────────────────────

/** yalnızca snapshot okunur. */
export async function getPublicStatus(slug, now = Date.now()) {
  const provider = providerOf(slug);
  const row = await prisma.integrationSetting.findUnique({
    where: { provider: SLUG_TO_PROVIDER[slug] },
  });
  if (!row?.isEnabled) return { enabled: false, stale: false, data: null };
  let data = row.publicSnapshot ?? null;
  // Discord: bot API'sinin vermediği hitap şekli admin config'inden.
  if (slug === 'discord' && data) {
    data = { ...data, pronouns: row.config?.pronouns || null };
  }
  const stale = !row.snapshotAt || now - row.snapshotAt.getTime() > provider.staleAfterMs;
  const out = { enabled: true, stale, updatedAt: row.snapshotAt, data };
  if (slug === 'github') {
    out.cards = {
      stats: '/api/public/status/github/cards/stats.svg',
      streak: '/api/public/status/github/cards/streak.svg',
    };
  }
  return out;
}

export async function githubUsernameIfEnabled() {
  const row = await prisma.integrationSetting.findUnique({ where: { provider: 'GITHUB' } });
  return row?.isEnabled && row.config?.username ? String(row.config.username) : null;
}
