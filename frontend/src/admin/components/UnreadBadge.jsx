// FR-MSG-07 — sidebar okunmamış mesaj rozeti; 60 sn'de bir yenilenir, 99+ üst sınır.
import { useQuery } from '@tanstack/react-query';
import { hasPermission } from '@vasquez/shared';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { adminKeys, messagesApi } from '../lib/adminApi.js';

export const formatBadgeCount = (count) => (count > 99 ? '99+' : String(count));

export function useUnreadCount() {
  const admin = useAuthStore((s) => s.admin);
  return useQuery({
    queryKey: adminKeys.unreadCount,
    queryFn: messagesApi.unreadCount,
    enabled: hasPermission(admin, 'messages:read'),
    refetchInterval: 60_000,
    select: (data) => data?.count ?? 0,
  });
}

export function UnreadBadge() {
  const { data: count = 0 } = useUnreadCount();
  if (count <= 0) return null;
  return (
    <span className="bg-primary text-primary-foreground ml-auto min-w-5 rounded-full px-1.5 text-center text-[11px] leading-5 font-semibold tabular-nums">
      {formatBadgeCount(count)}
      <span className="sr-only"> okunmamış mesaj</span>
    </span>
  );
}
