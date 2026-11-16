// SRS §10, SEC-15 — standart hata yanıtı; stack trace istemciye gitmez.
import { ZodError } from 'zod';
import { AppError } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

function normalize(err) {
  if (err instanceof AppError) return err;
  if (err instanceof ZodError) {
    return new AppError(422, 'VALIDATION_ERROR', 'Gönderilen veriler geçersiz.', {
      details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err?.type === 'entity.parse.failed') {
    return new AppError(400, 'BAD_REQUEST', 'İstek gövdesi geçerli JSON değil.');
  }
  if (err?.type === 'entity.too.large') {
    return new AppError(413, 'PAYLOAD_TOO_LARGE', 'İstek gövdesi çok büyük.');
  }
  return null;
}

// Express hata middleware'i dört parametre ister (_next kullanılmasa da imzada kalmalı).
export function errorHandler(err, req, res, _next) {
  let error = normalize(err);
  if (!error) {
    (req.log ?? logger).error({ err }, 'Beklenmeyen hata');
    error = new AppError(500, 'INTERNAL_ERROR', 'Beklenmeyen bir hata oluştu.');
  }

  if (error.headers) res.set(error.headers);
  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined && { details: error.details }),
      requestId: req.id,
    },
  });
}
