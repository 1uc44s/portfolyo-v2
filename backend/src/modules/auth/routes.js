// ROUTES.md §4.1 — /api/admin/auth. Katmanlar: L1 (pre-auth), L2 (cookie+CSRF), L3 (/me).
import { Router } from 'express';
import {
  forgotPasswordSchema,
  loginSchema,
  mfaVerifySchema,
  resetPasswordSchema,
} from '@vasquez/shared';
import { sha256Hex } from '../../lib/hash.js';
import { passwordGate, requireAuth } from '../../middleware/auth.js';
import { consume, rateLimit } from '../../middleware/rateLimit.js';
import { validate } from '../../middleware/validate.js';
import { publicCaptchaConfig } from '../../lib/turnstile.js';
import { requestContext } from '../audit/service.js';
import { assertCaptcha } from '../contact/service.js';
import { clearSessionCookies, CSRF_COOKIE, REFRESH_COOKIE, setSessionCookies } from './cookies.js';
import { requestPasswordReset, resetPassword } from './passwordReset.js';
import { getMe, login, logout, refreshSession, verifySecondFactor } from './service.js';

const sessionResponse = (res, result) => {
  setSessionCookies(res, result);
  res.json({
    data: { accessToken: result.accessToken, expiresIn: result.expiresIn, admin: result.admin },
  });
};

const cookieCredentials = (req) => ({
  refreshToken: req.cookies?.[REFRESH_COOKIE],
  csrfCookie: req.cookies?.[CSRF_COOKIE],
  csrfHeader: req.get('x-csrf-token'),
});

/** @param {{ limiters: Record<string, import('rate-limiter-flexible').RateLimiterMemory> }} deps */
export function authRoutes({ limiters }) {
  const router = Router();

  // Giriş ekranı için Turnstile site anahtarı (gizli değildir).
  router.get('/captcha', (_req, res) => {
    res.json({ data: publicCaptchaConfig() });
  });

  router.post('/login', validate({ body: loginSchema }), async (req, res) => {
    const { email, turnstileToken, ...credentials } = req.valid.body;
    // E-posta sayacı IP ile birlikte tutulur: e-postayı bilen biri başka IP'lerden gerçek
    // sahibini kilitleyemez (hesap kilidi DoS'u). IP başına toplam sınır loginIp'tedir.
    const emailKey = `${email}|${req.ip}`;
    await consume(limiters.loginIp, req.ip);
    const attempt = await consume(limiters.loginEmail, emailKey);
    // Bot doğrulaması şifre kontrolünden önce: otomatik denemeler argon2'ye ulaşmaz.
    // Sayaçlardan sonra: siteverify çağrıları da hız sınırına tabidir.
    await assertCaptcha(turnstileToken, req.ip);
    const result = await login({ email, ...credentials }, requestContext(req), {
      cleanSource: attempt.consumedPoints === 1,
    });
    if (result.mfaRequired) {
      res.json({ data: { mfaRequired: true, mfaToken: result.mfaToken } });
      return;
    }
    await limiters.loginEmail.delete(emailKey);
    sessionResponse(res, result);
  });

  router.post('/2fa/verify', validate({ body: mfaVerifySchema }), async (req, res) => {
    await consume(limiters.mfa, sha256Hex(req.valid.body.mfaToken));
    sessionResponse(res, await verifySecondFactor(req.valid.body, requestContext(req)));
  });

  router.post('/refresh', rateLimit(limiters.refresh), async (req, res) => {
    try {
      sessionResponse(res, await refreshSession(cookieCredentials(req), requestContext(req)));
    } catch (err) {
      if (err.status === 401) clearSessionCookies(res);
      throw err;
    }
  });

  router.post('/logout', async (req, res) => {
    try {
      await logout(cookieCredentials(req), requestContext(req));
    } finally {
      clearSessionCookies(res);
    }
    res.status(204).end();
  });

  router.post('/forgot-password', validate({ body: forgotPasswordSchema }), async (req, res) => {
    await consume(limiters.forgotIp, req.ip);
    await consume(limiters.forgotEmail, req.valid.body.email);
    await requestPasswordReset(req.valid.body.email, requestContext(req));
    res.status(202).json({
      data: {
        ok: true,
        message: 'Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi.',
      },
    });
  });

  router.post(
    '/reset-password',
    rateLimit(limiters.reset),
    validate({ body: resetPasswordSchema }),
    async (req, res) => {
      await resetPassword(req.valid.body, requestContext(req));
      res.json({ data: { ok: true } });
    },
  );

  router.get('/me', requireAuth, passwordGate, async (req, res) => {
    res.json({ data: await getMe(req.admin.id) });
  });

  return router;
}
