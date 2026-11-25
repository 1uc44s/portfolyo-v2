// secret alanları loglara düşmez.
import pino from 'pino';
import { env } from '../config/env.js';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  '*.password',
  '*.currentPassword',
  '*.newPassword',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.secret',
  '*.botToken',
  '*.clientSecret',
  '*.appPassword',
  '*.code',
  '*.recoveryCode',
];

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
  base: { service: 'my-portfolyo-api' },
});
