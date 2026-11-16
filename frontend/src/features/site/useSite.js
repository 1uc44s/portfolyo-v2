// ROUTES.md §3.1 — public sayfa iskeleti; tüm public bileşenler aynı önbelleği paylaşır.
import { useQuery } from '@tanstack/react-query';
import { fetchSite } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';

export const useSite = () =>
  useQuery({ queryKey: queryKeys.site, queryFn: fetchSite, staleTime: 60_000 });
