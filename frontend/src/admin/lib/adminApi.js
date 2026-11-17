// ROUTES.md §4.1–4.2 — admin auth ve hesap uçları. Bearer token interceptor'dan gelir.
import { api } from '@/lib/api/client.js';

const unwrap = (promise) => promise.then((res) => res.data?.data);

const UPLOAD_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Multipart yükleme: byte bazlı ilerleme + AbortSignal ile iptal (T-MEDIA-07).
 * Yanıtın tamamı ({ data, meta }) döner; meta.duplicateOf FR-MED-10 uyarısıdır.
 */
export function uploadFile(method, url, file, { field = 'file', ...options } = {}) {
  return uploadForm(method, url, { files: { [field]: file } }, options);
}

/**
 * Çok dosyalı multipart (F7: müzik ses + kapak, cursor normal + tıklama) + düz alanlar.
 * @param {{ files?: Record<string, File|null|undefined>, fields?: Record<string, unknown> }} parts
 */
export function uploadForm(method, url, { files = {}, fields = {} }, { onProgress, signal } = {}) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) body.append(key, String(value));
  }
  let size = 0;
  for (const [key, file] of Object.entries(files)) {
    if (!file) continue;
    body.append(key, file);
    size += file.size;
  }
  return api
    .request({
      method,
      url,
      data: body,
      signal,
      timeout: UPLOAD_TIMEOUT_MS,
      onUploadProgress: (event) => onProgress?.(event.loaded, event.total ?? size),
    })
    .then((res) => res.data);
}

export const authApi = {
  login: (body) => unwrap(api.post('/admin/auth/login', body)),
  captcha: () => unwrap(api.get('/admin/auth/captcha')),
  verifySecondFactor: (body) => unwrap(api.post('/admin/auth/2fa/verify', body)),
  forgotPassword: (body) => unwrap(api.post('/admin/auth/forgot-password', body)),
  resetPassword: (body) => unwrap(api.post('/admin/auth/reset-password', body)),
  me: () => unwrap(api.get('/admin/auth/me')),
};

export const accountApi = {
  updateProfile: (body) => unwrap(api.patch('/admin/account/profile', body)),
  changeEmail: (body) => unwrap(api.post('/admin/account/email', body)),
  changePassword: (body) => unwrap(api.post('/admin/account/password', body)),
  getMail: () => unwrap(api.get('/admin/account/mail')),
  updateMail: (body) => unwrap(api.put('/admin/account/mail', body)),
  testMail: (body = {}) => unwrap(api.post('/admin/account/mail/test', body)),
  setupTwoFactor: (body) => unwrap(api.post('/admin/account/2fa/setup', body)),
  enableTwoFactor: (body) => unwrap(api.post('/admin/account/2fa/enable', body)),
  disableTwoFactor: (body) => unwrap(api.post('/admin/account/2fa/disable', body)),
  regenerateRecoveryCodes: (body) => unwrap(api.post('/admin/account/2fa/recovery-codes', body)),
  listSessions: () => unwrap(api.get('/admin/account/sessions')),
  revokeSession: (id) => api.delete(`/admin/account/sessions/${id}`),
  revokeOtherSessions: () => unwrap(api.post('/admin/account/sessions/revoke-others')),
};

export const settingsApi = {
  get: () => unwrap(api.get('/admin/settings')),
  update: (body) => unwrap(api.patch('/admin/settings', body)),
  updateAbout: (body) => unwrap(api.put('/admin/settings/about', body)),
  uploadFavicon: (file, options) => uploadFile('put', '/admin/settings/favicon', file, options),
  clearFavicon: () => unwrap(api.delete('/admin/settings/favicon')),
};

export const heroApi = {
  get: () => unwrap(api.get('/admin/hero')),
  update: (body) => unwrap(api.put('/admin/hero', body)),
  profileOptions: () => unwrap(api.get('/admin/hero/profile-options')),
};

/** ROUTES.md §4.6 — içerik türleri (`type` ∈ MEDIA_CONTENT_TYPES) ve kütüphane uçları. */
export const mediaApi = {
  list: (type, params) => api.get(`/admin/media/${type}`, { params }).then((res) => res.data),
  get: (type, id) => unwrap(api.get(`/admin/media/${type}/${id}`)),
  create: (type, parts, options) => uploadForm('post', `/admin/media/${type}`, parts, options),
  update: (type, id, body) => unwrap(api.patch(`/admin/media/${type}/${id}`, body)),
  replaceFiles: (type, id, parts, options) =>
    uploadForm('put', `/admin/media/${type}/${id}/file`, parts, options),
  reorder: (type, ids) => api.patch(`/admin/media/${type}/reorder`, { ids }),
  remove: (type, id) => api.delete(`/admin/media/${type}/${id}`),
  assets: (params) => api.get('/admin/media/assets', { params }).then((res) => res.data),
  deleteAsset: (id) => api.delete(`/admin/media/assets/${id}`),
  storage: () => unwrap(api.get('/admin/media/storage')),
};

/** ROUTES.md §4.4 — günlük rotasyon. Her yazma güncel özeti döndürür. */
export const rotationApi = {
  get: () => unwrap(api.get('/admin/rotation')),
  setOverride: (category, contentId) =>
    unwrap(api.put(`/admin/rotation/${category}/override`, { contentId })),
  clearOverride: (category) => unwrap(api.delete(`/admin/rotation/${category}/override`)),
  reselect: (category) => unwrap(api.post(`/admin/rotation/${category}/reselect`)),
};

// ROUTES.md §4.9 — kategoriler.
export const categoriesApi = {
  list: () => unwrap(api.get('/admin/categories')),
  create: (body) => unwrap(api.post('/admin/categories', body)),
  update: (id, body) => unwrap(api.patch(`/admin/categories/${id}`, body)),
  reorder: (ids) => api.patch('/admin/categories/reorder', { ids }),
  remove: (id) => api.delete(`/admin/categories/${id}`),
  reassignAndDelete: (id, targetCategoryId) =>
    unwrap(api.post(`/admin/categories/${id}/reassign-and-delete`, { targetCategoryId })),
};

// ROUTES.md §4.8 — projeler ve görselleri.
export const projectsApi = {
  list: (params) => unwrap(api.get('/admin/projects', { params })),
  get: (id) => unwrap(api.get(`/admin/projects/${id}`)),
  create: (body) => unwrap(api.post('/admin/projects', body)),
  update: (id, body) => unwrap(api.patch(`/admin/projects/${id}`, body)),
  remove: (id) => api.delete(`/admin/projects/${id}`),
  reorder: (ids) => api.patch('/admin/projects/reorder', { ids }),
  slugCheck: (slug, excludeId) =>
    unwrap(api.get('/admin/projects/slug-check', { params: { slug, excludeId } })),
  /** Tek dosya yükler (her dosya kendi ilerlemesiyle); yanıt { data: proje, meta }. */
  addImage: (id, file, options) =>
    uploadFile('post', `/admin/projects/${id}/images`, file, { field: 'files', ...options }),
  reorderImages: (id, ids) => unwrap(api.patch(`/admin/projects/${id}/images/reorder`, { ids })),
  updateImage: (id, imageId, body) =>
    unwrap(api.patch(`/admin/projects/${id}/images/${imageId}`, body)),
  removeImage: (id, imageId) => unwrap(api.delete(`/admin/projects/${id}/images/${imageId}`)),
};

// ROUTES.md §4.10 — linkler (oluşturma multipart `image`).
export const linksApi = {
  list: () => unwrap(api.get('/admin/links')),
  create: ({ image, ...fields }, options) =>
    uploadForm('post', '/admin/links', { files: { image }, fields }, options),
  update: (id, body) => unwrap(api.patch(`/admin/links/${id}`, body)),
  replaceImage: (id, file, options) =>
    uploadFile('put', `/admin/links/${id}/image`, file, { field: 'image', ...options }),
  reorder: (ids) => api.patch('/admin/links/reorder', { ids }),
  remove: (id) => api.delete(`/admin/links/${id}`),
};

/** ROUTES.md §4.11 — iletişim mesajları. list: { data, meta }. */
export const messagesApi = {
  list: (params) => api.get('/admin/contact-messages', { params }).then((res) => res.data),
  unreadCount: () => unwrap(api.get('/admin/contact-messages/unread-count')),
  open: (id) => unwrap(api.get(`/admin/contact-messages/${id}`)),
  update: (id, body) => unwrap(api.patch(`/admin/contact-messages/${id}`, body)),
  replyLinks: (id) => unwrap(api.post(`/admin/contact-messages/${id}/reply-links`)),
  remove: (id) => api.delete(`/admin/contact-messages/${id}`),
};

/** ROUTES.md §4.13 — audit log (salt okunur). CSV yalnızca SUPER_ADMIN; Bearer gerektiği için blob. */
export const auditApi = {
  list: (params) => api.get('/admin/audit-logs', { params }).then((res) => res.data),
  filters: () => unwrap(api.get('/admin/audit-logs/filters')),
  exportCsv: (params) =>
    api
      .get('/admin/audit-logs/export.csv', { params, responseType: 'blob', timeout: 120_000 })
      .then((res) => res.data),
};

/** ROUTES.md §4.7 — entegrasyonlar. Secret değerleri hiçbir yanıtta dönmez. */
export const integrationsApi = {
  list: () => unwrap(api.get('/admin/integrations')),
  update: (slug, body) => unwrap(api.patch(`/admin/integrations/${slug}`, body)),
  setSecrets: (slug, body) => unwrap(api.put(`/admin/integrations/${slug}/secrets`, body)),
  test: (slug) => unwrap(api.post(`/admin/integrations/${slug}/test`)),
  sync: (slug) => unwrap(api.post(`/admin/integrations/${slug}/sync`)),
  spotifyAuthorize: () => unwrap(api.get('/admin/integrations/spotify/authorize')),
  spotifyDisconnect: () => api.delete('/admin/integrations/spotify/connection'),
};

/** ROUTES.md §4.7b — yağan öğeler (2026-11-16). */
export const fallingApi = {
  list: () => unwrap(api.get('/admin/falling-items')),
  create: ({ image, ...fields }, options) =>
    uploadForm('post', '/admin/falling-items', { files: { image }, fields }, options),
  update: (id, body) => unwrap(api.patch(`/admin/falling-items/${id}`, body)),
  replaceImage: (id, file, options) =>
    uploadFile('put', `/admin/falling-items/${id}/image`, file, { field: 'image', ...options }),
  reorder: (ids) => api.patch('/admin/falling-items/reorder', { ids }),
  remove: (id) => api.delete(`/admin/falling-items/${id}`),
};

/** ROUTES.md §4.13 — Tech Stack (F21). */
export const techStackApi = {
  get: () => unwrap(api.get('/admin/tech-stack')),
  // Bölümler ("My Tech Stack", "My Security Skill"…)
  createGroup: (body = {}) => unwrap(api.post('/admin/tech-stack/groups', body)),
  updateGroup: (groupId, body) => unwrap(api.put(`/admin/tech-stack/groups/${groupId}`, body)),
  removeGroup: (groupId) => api.delete(`/admin/tech-stack/groups/${groupId}`),
  reorderGroups: (ids) => api.patch('/admin/tech-stack/groups/reorder', { ids }),
  // Bir bölümün öğeleri
  createItem: (groupId, { image, ...fields }, options) =>
    uploadForm(
      'post',
      `/admin/tech-stack/groups/${groupId}/items`,
      { files: { image }, fields },
      options,
    ),
  reorder: (groupId, ids) =>
    api.patch(`/admin/tech-stack/groups/${groupId}/items/reorder`, { ids }),
  // Tek öğe
  updateItem: (id, body) => unwrap(api.patch(`/admin/tech-stack/items/${id}`, body)),
  replaceImage: (id, file, options) =>
    uploadFile('put', `/admin/tech-stack/items/${id}/image`, file, { field: 'image', ...options }),
  removeImage: (id) => unwrap(api.delete(`/admin/tech-stack/items/${id}/image`)),
  remove: (id) => api.delete(`/admin/tech-stack/items/${id}`),
};

/** ROUTES.md §4.3 — Dashboard özeti. */
export const dashboardApi = {
  summary: (range) => unwrap(api.get('/admin/dashboard/summary', { params: { range } })),
};

/** ROUTES.md §4.12 — Sistem: yasal metinler. */
export const systemApi = {
  legal: () => unwrap(api.get('/admin/system/legal')),
  saveLegal: (slug, body) => unwrap(api.put(`/admin/system/legal/${slug}`, body)),
};

export const adminKeys = {
  audit: (params) => ['admin', 'audit', ...(params ? [params] : [])],
  auditFilters: ['admin', 'audit-filters'],
  integrations: ['admin', 'integrations'],
  dashboard: (range) => ['admin', 'dashboard', range],
  legal: ['admin', 'system', 'legal'],
  techStack: ['admin', 'tech-stack'],
  falling: ['admin', 'falling-items'],
  links: ['admin', 'links'],
  messages: (params) => ['admin', 'messages', ...(params ? [params] : [])],
  message: (id) => ['admin', 'message', id],
  unreadCount: ['admin', 'messages-unread'],
  categories: ['admin', 'categories'],
  projects: (params) => ['admin', 'projects', ...(params ? [params] : [])],
  project: (id) => ['admin', 'project', id],
  rotation: ['admin', 'rotation'],
  mail: ['admin', 'account', 'mail'],
  sessions: ['admin', 'account', 'sessions'],
  settings: ['admin', 'settings'],
  hero: ['admin', 'hero'],
  heroProfileOptions: ['admin', 'hero', 'profile-options'],
  media: (type, params) => ['admin', 'media', type, ...(params ? [params] : [])],
  mediaAssets: (params) => ['admin', 'media', 'assets', ...(params ? [params] : [])],
  mediaStorage: ['admin', 'media', 'storage'],
  mediaBlob: (url) => ['admin', 'media', 'blob', url],
};
