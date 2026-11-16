// SRS SEC-08, ROUTES.md §6 — hız sınırları. v1: tek instance, bellek içi
// (çoklu instance'ta RateLimiterRedis'e geçilir — ARCHITECTURE.md §9.1).
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { AppError } from '../lib/httpError.js';

/** points: izin verilen istek, duration: pencere (sn). */
export const RATE_LIMITS = Object.freeze({
  loginIp: { points: 10, duration: 15 * 60 },
  loginEmail: { points: 5, duration: 15 * 60 },
  mfa: { points: 5, duration: 15 * 60 },
  refresh: { points: 60, duration: 60 },
  forgotIp: { points: 3, duration: 60 * 60 },
  forgotEmail: { points: 3, duration: 60 * 60 },
  reset: { points: 10, duration: 60 * 60 },
  adminApi: { points: 600, duration: 60 },
  publicGlobal: { points: 300, duration: 60 },
  upload: { points: 60, duration: 10 * 60 },
  download: { points: 30, duration: 10 * 60 },
  // FR-CNT-02 — iletişim: IP başına 3 / 10 dk ve 10 / gün.
  contact10m: { points: 3, duration: 10 * 60 },
  contactDay: { points: 10, duration: 24 * 60 * 60 },
  // F16 — ROUTES.md §6: çerez tercihi 20/saat, analitik 120/dk (IP).
  consent: { points: 20, duration: 60 * 60 },
  analytics: { points: 120, duration: 60 },
});

/** Her app örneği kendi sayaçlarını taşır (testlerde izolasyon). */
export function createRateLimiters(overrides = {}) {
  return Object.fromEntries(
    Object.entries({ ...RATE_LIMITS, ...overrides }).map(([name, opts]) => [
      name,
      new RateLimiterMemory({ keyPrefix: name, ...opts }),
    ]),
  );
}

/** @param {RateLimiterRes} res */
const rateLimitedError = (res) => {
  const retryAfter = Math.max(1, Math.ceil(res.msBeforeNext / 1000));
  return new AppError(429, 'RATE_LIMITED', 'Çok fazla deneme yaptın. Biraz sonra tekrar dene.', {
    headers: { 'Retry-After': String(retryAfter) },
    details: { retryAfter },
  });
};

/**
 * Sayaçtan bir puan düşer; limit aşıldıysa 429 fırlatır.
 * @param {RateLimiterMemory} limiter @param {string} key
 */
export async function consume(limiter, key) {
  try {
    await limiter.consume(key);
  } catch (err) {
    if (err instanceof RateLimiterRes) throw rateLimitedError(err);
    throw err;
  }
}

/**
 * @param {RateLimiterMemory} limiter
 * @param {(req: import('express').Request) => string} [keyOf]
 */
export const rateLimit =
  (limiter, keyOf = (req) => req.ip) =>
  async (req, _res, next) => {
    await consume(limiter, keyOf(req));
    next();
  };
