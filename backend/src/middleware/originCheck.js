// durum değiştiren isteklerde Origin (yoksa Referer) izinli olmalı.
import { AppError } from '../lib/httpError.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

/** @param {string[]} allowedOrigins */
export function originCheck(allowedOrigins) {
  const allowed = new Set(allowedOrigins.map(originOf).filter(Boolean));
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin') ?? originOf(req.get('referer') ?? '');
    if (!origin || !allowed.has(origin)) {
      return next(new AppError(403, 'CSRF_FAILED', 'İstek kaynağı doğrulanamadı.'));
    }
    return next();
  };
}
