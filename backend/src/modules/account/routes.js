// ROUTES.md §4.2 — /api/admin/account (L3: kendi hesabı; SMTP yazma L5).
import { Router } from 'express';
import { z } from 'zod';
import {
  changeEmailSchema,
  changePasswordSchema,
  mailSettingsSchema,
  mailTestSchema,
  profileSchema,
  recoveryRegenerateSchema,
  twoFactorDisableSchema,
  twoFactorEnableSchema,
  twoFactorSetupSchema,
} from '@vasquez/shared';
import { requireSuper } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { requestContext } from '../audit/service.js';
import * as account from './service.js';

const sessionParams = z.object({ id: z.uuid('Geçersiz oturum.') }).strict();

export function accountRoutes() {
  const router = Router();
  const ctx = (req) => requestContext(req);

  router.patch('/profile', validate({ body: profileSchema }), async (req, res) => {
    res.json({ data: await account.updateProfile(req.admin.id, req.valid.body, ctx(req)) });
  });

  router.post('/email', validate({ body: changeEmailSchema }), async (req, res) => {
    res.json({ data: await account.changeEmail(req.admin.id, req.valid.body, ctx(req)) });
  });

  router.post('/password', validate({ body: changePasswordSchema }), async (req, res) => {
    const admin = await account.changePassword(
      req.admin.id,
      req.auth.familyId,
      req.valid.body,
      ctx(req),
    );
    res.json({ data: admin });
  });

  router.get('/mail', async (_req, res) => {
    res.json({ data: await account.getMail() });
  });

  router.put('/mail', requireSuper, validate({ body: mailSettingsSchema }), async (req, res) => {
    res.json({ data: await account.updateMail(req.admin.id, req.valid.body, ctx(req)) });
  });

  router.post('/mail/test', requireSuper, validate({ body: mailTestSchema }), async (req, res) => {
    res.json({ data: await account.testMail(req.admin, req.valid.body, ctx(req)) });
  });

  router.post('/2fa/setup', validate({ body: twoFactorSetupSchema }), async (req, res) => {
    const { otpauthUrl, qrDataUrl, secret } = await account.setupTwoFactor(
      req.admin.id,
      req.valid.body,
      ctx(req),
    );
    res.json({ data: { otpauthUrl, qrDataUrl, secret } });
  });

  router.post('/2fa/enable', validate({ body: twoFactorEnableSchema }), async (req, res) => {
    const result = await account.enableTwoFactor(
      req.admin.id,
      req.auth.familyId,
      req.valid.body,
      ctx(req),
    );
    res.json({ data: result });
  });

  router.post('/2fa/disable', validate({ body: twoFactorDisableSchema }), async (req, res) => {
    await account.disableTwoFactor(req.admin.id, req.auth.familyId, req.valid.body, ctx(req));
    res.json({ data: { ok: true } });
  });

  router.post(
    '/2fa/recovery-codes',
    validate({ body: recoveryRegenerateSchema }),
    async (req, res) => {
      res.json({
        data: await account.regenerateRecoveryCodes(req.admin.id, req.valid.body, ctx(req)),
      });
    },
  );

  router.get('/sessions', async (req, res) => {
    res.json({ data: await account.getSessions(req.admin.id, req.auth.familyId) });
  });

  router.post('/sessions/revoke-others', async (req, res) => {
    res.json({
      data: await account.revokeOtherSessions(req.admin.id, req.auth.familyId, ctx(req)),
    });
  });

  router.delete('/sessions/:id', validate({ params: sessionParams }), async (req, res) => {
    await account.revokeSession(req.admin.id, req.valid.params.id, ctx(req));
    res.status(204).end();
  });

  return router;
}
