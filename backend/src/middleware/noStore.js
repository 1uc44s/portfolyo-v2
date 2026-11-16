// SRS SEC-19 — admin yanıtları önbelleğe alınmaz.
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
}
