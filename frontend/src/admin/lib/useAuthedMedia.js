// yetkili önizleme (`/api/admin/media/assets/:id/file/:variant`) Bearer token ister; <img>/<video>
// başlık gönderemediği için dosya axios ile blob olarak çekilip object URL'e çevrilir (CSP img/media-src
// blob: izinli). Object URL'ler sorgu önbellekten düşünce serbest bırakılır.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client.js';
import { adminKeys } from './adminApi.js';

const BLOB_PREFIX = adminKeys.mediaBlob('').slice(0, 3);
const isBlobQuery = (key) => BLOB_PREFIX.every((part, i) => key[i] === part);

/** Kök bileşende bir kez: önbellekten çıkan blob sorgularının URL'lerini serbest bırakır. */
export function useBlobUrlCleanup() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      queryClient.getQueryCache().subscribe((event) => {
        if (event.type !== 'removed' || !isBlobQuery(event.query.queryKey)) return;
        const url = event.query.state.data;
        if (typeof url === 'string') URL.revokeObjectURL(url);
      }),
    [queryClient],
  );
}

/**
 * @param {string|null|undefined} url `/api/admin/...` yolu
 * @param {{ enabled?: boolean }} [options]
 * @returns {{ src: string|undefined, isLoading: boolean, isError: boolean }}
 */
export function useAuthedMedia(url, { enabled = true } = {}) {
  const query = useQuery({
    queryKey: adminKeys.mediaBlob(url),
    enabled: Boolean(url) && enabled,
    staleTime: Infinity,
    gcTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      const res = await api.get(url.replace(/^\/api/, ''), { responseType: 'blob', signal });
      return URL.createObjectURL(res.data);
    },
  });
  return { src: query.data, isLoading: query.isLoading, isError: query.isError };
}
