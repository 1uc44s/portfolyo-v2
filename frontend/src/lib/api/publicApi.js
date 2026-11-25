import { api } from './client.js';

export async function fetchHealth() {
  const { data } = await api.get('/health');
  return data.data;
}

/** public sayfa iskeleti (navbar, favicon, hero…). */
export async function fetchSite() {
  const { data } = await api.get('/public/site');
  return data.data;
}

/** `kind` ∈ wallpapers | pfps; keyset `cursor` (son id). Dönüş: { data, meta }. */
export async function fetchDownloads(kind, cursor) {
  const { data } = await api.get(`/public/${kind}`, { params: cursor ? { cursor } : {} });
  return data;
}

/** yayındaki projeler (ProjectCard[]). */
export async function fetchProjects() {
  const { data } = await api.get('/public/projects');
  return data.data;
}

/** Filtre çipleri: yayında projesi olan aktif kategoriler. */
export async function fetchProjectCategories() {
  const { data } = await api.get('/public/categories');
  return data.data;
}

/** proje detayı; yoksa axios 404 hatası. */
export async function fetchProject(slug) {
  const { data } = await api.get(`/public/projects/${encodeURIComponent(slug)}`);
  return data.data;
}

/** aktif linkler (boşsa []). */
export async function fetchLinks() {
  const { data } = await api.get('/public/links');
  return data.data;
}

/** iletişim formu; başarıda { ok: true }. */
export async function sendContact(values) {
  const { data } = await api.post('/public/contact', values);
  return data.data;
}

/** `key` ∈ kvkk-notice | cookie-policy. */
export async function fetchLegal(key) {
  const { data } = await api.get(`/public/legal/${key}`);
  return data.data;
}

/** `slug` ∈ discord | spotify | github; snapshot { enabled, stale, updatedAt, data, cards? }. */
export async function fetchStatus(slug) {
  const { data } = await api.get(`/public/status/${slug}`);
  return data.data;
}

/** Tech Stack; yayında değilse { published: false }. */
export async function fetchTechStack() {
  const { data } = await api.get('/public/tech-stack');
  return data.data;
}
