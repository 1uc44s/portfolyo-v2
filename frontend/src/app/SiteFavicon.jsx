// Yüklenen favicon'u sekmeye uygular; yoksa varsayılan /favicon.svg.
// public kabuğu gelene kadar site aggregate'inden yalnızca faviconUrl okunur.
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSite } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';

export const DEFAULT_FAVICON = { href: '/favicon.svg', type: 'image/svg+xml' };

export function applyFavicon(url, doc = document) {
  let link = doc.querySelector('link[rel="icon"]');
  if (!link) {
    link = doc.createElement('link');
    link.rel = 'icon';
    doc.head.append(link);
  }
  if (url) {
    link.removeAttribute('type'); // ico/png: tarayıcı içerikten anlar
    link.href = url;
  } else {
    link.type = DEFAULT_FAVICON.type;
    link.href = DEFAULT_FAVICON.href;
  }
}

export function SiteFavicon() {
  const { data } = useQuery({ queryKey: queryKeys.site, queryFn: fetchSite, staleTime: 60_000 });
  const url = data?.faviconUrl ?? null;
  useEffect(() => {
    if (data) applyFavicon(url);
  }, [data, url]);
  return null;
}
