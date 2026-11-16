import { NotFoundError } from '../lib/httpError.js';

export function notFound(_req, _res, next) {
  next(new NotFoundError('İstenen adres bulunamadı.'));
}
