// standart hata sınıfları.
export class AppError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {{ details?: unknown, headers?: Record<string, string> }} [options]
   */
  constructor(status, code, message, options = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.headers = options.headers;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'İstek biçimi geçersiz.', options) {
    super(400, 'BAD_REQUEST', message, options);
  }
}

export class UnauthenticatedError extends AppError {
  constructor(message = 'Oturum açman gerekiyor.', options) {
    super(401, 'UNAUTHENTICATED', message, options);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Bu işlem için yetkin yok.', options) {
    super(403, 'FORBIDDEN', message, options);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Kayıt bulunamadı.', options) {
    super(404, 'NOT_FOUND', message, options);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Kayıt çakışması.', options) {
    super(409, 'CONFLICT', message, options);
  }
}

export class ValidationError extends AppError {
  constructor(details, message = 'Gönderilen veriler geçersiz.') {
    super(422, 'VALIDATION_ERROR', message, { details });
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = 'Dosya çok büyük.', options) {
    super(413, 'PAYLOAD_TOO_LARGE', message, options);
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(message = 'Bu dosya türü desteklenmiyor.', options) {
    super(415, 'UNSUPPORTED_MEDIA_TYPE', message, options);
  }
}
