// ARCHITECTURE.md §4.4 — tek uçuşlu refresh, sekmeler arası kilit ve senkron.
// - Aynı sekmede eşzamanlı 401'ler tek refresh isteğini bekler.
// - navigator.locks: iki sekme aynı anda refresh yapıp reuse tespitini tetiklemesin.
// - BroadcastChannel: yeni token ve çıkış diğer sekmelere iletilir.
import axios from 'axios';
import { useAuthStore } from './authStore.js';

export const CSRF_COOKIE = '__Host-csrf';
const LOCK_NAME = 'vasquez-auth-refresh';

/** Refresh/logout için interceptor'sız ayrı istemci (döngü olmasın). */
export const authApi = axios.create({
  baseURL: '/api/admin/auth',
  timeout: 15_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

/** @param {string} name */
export function readCookie(name) {
  const prefix = `${name}=`;
  const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return entry ? decodeURIComponent(entry.slice(prefix.length)) : null;
}

const channel =
  typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('vasquez-auth');

channel?.addEventListener('message', ({ data }) => {
  const store = useAuthStore.getState();
  if (data?.type === 'session' && data.accessToken) store.setSession(data);
  if (data?.type === 'logout') store.clear();
});

const withLock = (fn) =>
  typeof navigator !== 'undefined' && navigator.locks?.request
    ? navigator.locks.request(LOCK_NAME, fn)
    : fn();

let inflight = null;

/**
 * Oturumu yeniler. `staleToken` verilirse ve bu arada başka sekme/istek yenilediyse yeni
 * istek atılmaz, mevcut token döner.
 * @param {string|null} [staleToken]
 * @returns {Promise<string>} yeni access token
 */
export function refreshSession(staleToken = null) {
  inflight ??= withLock(async () => {
    const current = useAuthStore.getState().accessToken;
    if (current && staleToken && current !== staleToken) return current;

    try {
      const { data } = await authApi.post('/refresh', null, {
        headers: { 'X-CSRF-Token': readCookie(CSRF_COOKIE) ?? '' },
      });
      const session = { accessToken: data.data.accessToken, admin: data.data.admin };
      useAuthStore.getState().setSession(session);
      channel?.postMessage({ type: 'session', ...session });
      return session.accessToken;
    } catch (error) {
      // Yalnızca sunucu oturumu reddederse çıkış: ağ kesintisi, timeout veya 5xx'te oturum
      // korunur (form verisi kaybolmaz); istek hatası çağırana iletilir.
      // Açılıştaki ilk yenilemede (durum 'unknown') geri yüklenecek oturum yoktur: her hatada
      // giriş ekranına düşülür, yoksa sayfa yükleme iskeletinde kalırdı.
      const status = error?.response?.status;
      const booting = useAuthStore.getState().status === 'unknown';
      if (booting || status === 401 || status === 403) useAuthStore.getState().clear();
      throw error;
    }
  }).finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Sunucu oturumunu kapatır; ağ hatası olsa da yerel durum temizlenir. */
export async function logout() {
  try {
    await authApi.post('/logout', null, {
      headers: { 'X-CSRF-Token': readCookie(CSRF_COOKIE) ?? '' },
    });
  } finally {
    useAuthStore.getState().clear();
    channel?.postMessage({ type: 'logout' });
  }
}

/** Giriş / 2FA başarısında çağrılır. */
export function startSession({ accessToken, admin }) {
  useAuthStore.getState().setSession({ accessToken, admin });
  channel?.postMessage({ type: 'session', accessToken, admin });
}
