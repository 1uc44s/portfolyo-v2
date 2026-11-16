// FR-AUTH-02/03 — access token (15 dk) ve MFA ara token'ı (5 dk). HS256, jose.
import { randomUUID } from 'node:crypto';
import { SignJWT, errors as joseErrors, jwtVerify } from 'jose';
import { env } from '../../config/env.js';
import { AppError, UnauthenticatedError } from '../../lib/httpError.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const MFA_TOKEN_TTL_SECONDS = 5 * 60;
const ISSUER = env.PUBLIC_ORIGIN;
const KEY = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const ALG = 'HS256';

/**
 * @param {{ id: string, role: string, permissions: string[] }} admin
 * @param {string} sessionFamilyId
 */
export function signAccessToken(admin, sessionFamilyId) {
  return new SignJWT({ role: admin.role, perms: admin.permissions, sid: sessionFamilyId })
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(admin.id)
    .setIssuer(ISSUER)
    .setAudience('admin')
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(KEY);
}

/** @param {string} token */
export async function verifyAccessToken(token) {
  let payload;
  try {
    ({ payload } = await jwtVerify(token, KEY, {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: 'admin',
    }));
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Oturum süresi doldu.');
    }
    throw new UnauthenticatedError();
  }
  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new UnauthenticatedError();
  }
  return payload;
}

/** @param {string} adminId @param {boolean} rememberMe */
export function signMfaToken(adminId, rememberMe) {
  return new SignJWT({ rm: rememberMe })
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(adminId)
    .setIssuer(ISSUER)
    .setAudience('mfa')
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${MFA_TOKEN_TTL_SECONDS}s`)
    .sign(KEY);
}

/** @param {string} token */
export async function verifyMfaToken(token) {
  try {
    const { payload } = await jwtVerify(token, KEY, {
      algorithms: [ALG],
      issuer: ISSUER,
      audience: 'mfa',
    });
    return {
      adminId: payload.sub,
      rememberMe: payload.rm === true,
      jti: payload.jti,
      exp: payload.exp,
    };
  } catch {
    throw new AppError(401, 'MFA_EXPIRED', 'Doğrulama süresi doldu. Yeniden giriş yap.');
  }
}
