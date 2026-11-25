// access token YALNIZCA bellekte. localStorage/sessionStorage yasak.
import { create } from 'zustand';

/** status: 'unknown' (henüz denenmedi) | 'authenticated' | 'anonymous' */
export const useAuthStore = create((set) => ({
  accessToken: null,
  admin: null,
  status: 'unknown',
  setSession: ({ accessToken, admin }) => set({ accessToken, admin, status: 'authenticated' }),
  setAdmin: (admin) => set({ admin }),
  clear: () => set({ accessToken: null, admin: null, status: 'anonymous' }),
}));

export const getAccessToken = () => useAuthStore.getState().accessToken;
