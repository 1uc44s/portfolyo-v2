// ROUTES.md §1.1 — requireAuth (L3), passwordGate, requirePermission (L4), requireSuper (L5).
import { hasPermission, ROLES } from '@vasquez/shared';
import { AppError, ForbiddenError, UnauthenticatedError } from '../lib/httpError.js';
import { verifyAccessToken } from '../modules/auth/tokens.js';
import { getLiveFamily } from '../modules/auth/sessions.js';

const BEARER = /^Bearer ([A-Za-z0-9._-]+)$/;

export async function requireAuth(req, _res, next) {
  const match = BEARER.exec(req.get('authorization') ?? '');
  if (!match) throw new UnauthenticatedError();

  const payload = await verifyAccessToken(match[1]);
  const live = await getLiveFamily(payload.sid);
  if (!live || live.admin.id !== payload.sub) {
    throw new UnauthenticatedError('Oturumun sonlandırıldı. Yeniden giriş yap.');
  }
  req.admin = live.admin;
  req.auth = { familyId: payload.sid, sessionId: live.sessionId };
  next();
}

/** FR-AUTH-09 — zorunlu şifre değişiminde yalnızca bu uçlar kullanılabilir. */
const PASSWORD_CHANGE_ALLOWLIST = new Set(['/api/admin/auth/me', '/api/admin/account/password']);

export function passwordGate(req, _res, next) {
  if (!req.admin?.mustChangePassword) return next();
  if (PASSWORD_CHANGE_ALLOWLIST.has(`${req.baseUrl}${req.path}`)) return next();
  return next(
    new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'Devam etmeden önce şifreni değiştirmelisin.'),
  );
}

/** @param {string} permission ör. "links:write" */
export const requirePermission = (permission) => (req, _res, next) =>
  hasPermission(req.admin, permission) ? next() : next(new ForbiddenError());

export const requireSuper = (req, _res, next) =>
  req.admin?.role === ROLES.SUPER_ADMIN ? next() : next(new ForbiddenError());
