// analitik gönderici. YALNIZCA izin varken dinamik import edilir (koşullu import);
// izin yoksa bu modül hiç yüklenmez ve ağda analitik isteği oluşmaz.
import { api } from '@/lib/api/client.js';

const send = (body) => api.post('/public/analytics/events', body).catch(() => {});

/** @param {string} path */
export const trackPage = (path) => send({ type: 'PAGE_VIEW', path: path.slice(0, 200) });

/** @param {string} slug @param {string} path */
export const trackProject = (slug, path) =>
  send({ type: 'PROJECT_VIEW', path: path.slice(0, 200), projectSlug: slug });
