// Zod doğrulaması; sonuç req.valid içine yazılır (Express 5'te req.query salt okunur).

/**
 * @param {{ body?: import('zod').ZodType, query?: import('zod').ZodType, params?: import('zod').ZodType }} schemas
 */
export const validate = (schemas) => (req, _res, next) => {
  req.valid ??= {};
  for (const part of ['params', 'query', 'body']) {
    if (schemas[part]) req.valid[part] = schemas[part].parse(req[part] ?? {});
  }
  next();
};
