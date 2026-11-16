// ARCHITECTURE.md §4.4 — tek axios örneği + admin auth interceptor'ları.
import axios from 'axios';
import { getAccessToken } from '../auth/authStore.js';
import { refreshSession } from '../auth/session.js';

export const api = axios.create({
  baseURL: '/api',
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

const isAdminRequest = (config) => String(config.url ?? '').startsWith('/admin');

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token && isAdminRequest(config)) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 TOKEN_EXPIRED → tek refresh → orijinal isteği bir kez tekrar dene.
api.interceptors.response.use(undefined, async (error) => {
  const { config, response } = error;
  const expired = response?.status === 401 && response.data?.error?.code === 'TOKEN_EXPIRED';
  if (!config || !expired || config._authRetried || !isAdminRequest(config)) throw error;

  const sentToken = String(config.headers?.Authorization ?? '').replace(/^Bearer /, '') || null;
  const token = await refreshSession(sentToken);
  config._authRetried = true;
  config.headers.Authorization = `Bearer ${token}`;
  return api.request(config);
});

/** API hata yanıtını (SRS §10) kullanıcıya gösterilebilir mesaja çevirir. */
export function getErrorMessage(
  error,
  fallback = 'Bir şeyler ters gitti. Sayfayı yenilemeyi dene.',
) {
  return error?.response?.data?.error?.message ?? fallback;
}
