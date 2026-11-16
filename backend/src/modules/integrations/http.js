// FR-INT-03 — dış çağrılar: 5 sn zaman aşımı, 429'da Retry-After. Testler fetch'i değiştirebilir.
// Hata mesajları kullanıcıya (admin) gösterilir: secret/token/URL sorgusu içermez.

export const TIMEOUT_MS = 5000;
const MAX_RETRY_AFTER_MS = 15 * 60_000;

let fetchImpl = (...args) => globalThis.fetch(...args);

/** Testler için (null → global fetch). */
export function setIntegrationFetch(fn) {
  fetchImpl = fn ?? ((...args) => globalThis.fetch(...args));
}

export class IntegrationError extends Error {
  /**
   * @param {string} message admin'e gösterilecek, secret içermeyen mesaj
   * @param {{ code?: string, status?: number, retryAfterMs?: number }} [options]
   */
  constructor(message, { code = 'INTEGRATION_ERROR', status, retryAfterMs } = {}) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const retryAfterOf = (res) => {
  const raw = res.headers?.get?.('retry-after');
  const seconds = Number(raw);
  if (!raw || !Number.isFinite(seconds)) return 60_000;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(1000, seconds * 1000));
};

/**
 * @param {string} url
 * @param {RequestInit & { service: string, allowStatuses?: number[] }} options
 * @returns {Promise<Response>}
 */
export async function request(url, { service, allowStatuses = [], ...init }) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new IntegrationError(
      timeout ? `${service} 5 sn içinde yanıt vermedi.` : `${service} servisine ulaşılamadı.`,
      { code: timeout ? 'TIMEOUT' : 'NETWORK' },
    );
  }
  if (res.ok || allowStatuses.includes(res.status)) return res;
  if (res.status === 429) {
    throw new IntegrationError(`${service} istek sınırına ulaşıldı; bekleniyor.`, {
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterMs: retryAfterOf(res),
    });
  }
  throw new IntegrationError(`${service} hata döndürdü (HTTP ${res.status}).`, {
    code: 'HTTP_ERROR',
    status: res.status,
  });
}

/** JSON gövde; bozuk JSON kontrollü hata. */
export async function requestJson(url, options) {
  const res = await request(url, options);
  if (res.status === 204) return { res, data: null };
  try {
    return { res, data: await res.json() };
  } catch {
    throw new IntegrationError(`${options.service} beklenmeyen bir yanıt döndürdü.`, {
      code: 'BAD_RESPONSE',
    });
  }
}

/** Admin'e gösterilecek güvenli hata metni (≤ 500). */
export const publicErrorMessage = (err) =>
  (err instanceof IntegrationError ? err.message : 'Beklenmeyen bir hata oluştu.').slice(0, 500);

/** RULES.md §5.1.2 — dış servisten gelen URL yalnızca https ise snapshot'a girer (aksi null). */
export function httpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    return new URL(value).protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}
