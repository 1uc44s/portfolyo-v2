// FR-AUTH-07 — açık oturumlar; tekil veya toplu sonlandırma (onaylı).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Laptop, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { describeUserAgent, formatDateTime, formatRelative } from '@/lib/format.js';
import { accountApi, adminKeys } from '../../lib/adminApi.js';
import { SettingsCard } from '../../components/SettingsCard.jsx';

function ConfirmButton({
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = 'outline',
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm">
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Vazgeç</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SessionsTab() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: adminKeys.sessions, queryFn: accountApi.listSessions });
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.sessions });

  const revokeOne = useMutation({
    mutationFn: accountApi.revokeSession,
    onSuccess: () => {
      toast.success('Oturum sonlandırıldı.');
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const revokeOthers = useMutation({
    mutationFn: accountApi.revokeOtherSessions,
    onSuccess: ({ revoked }) => {
      toast.success(revoked ? `${revoked} oturum sonlandırıldı.` : 'Başka açık oturum yok.');
      refresh();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const others = sessions.data?.filter((s) => !s.current).length ?? 0;

  return (
    <SettingsCard
      title="Açık oturumlar"
      description="Hesabına giriş yapılmış cihazlar. Tanımadığın bir oturum görürsen sonlandır ve şifreni değiştir."
      footer={
        others > 0 && (
          <ConfirmButton
            label="Diğer tüm oturumları sonlandır"
            title="Diğer oturumlar sonlandırılsın mı?"
            description={`Bu cihaz dışındaki ${others} oturum kapatılacak. O cihazlarda yeniden giriş yapılması gerekir.`}
            confirmLabel="Sonlandır"
            onConfirm={() => revokeOthers.mutate()}
          />
        )
      }
    >
      {sessions.isPending && (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-[68px] rounded-[var(--radius-md)]" />
          ))}
        </div>
      )}
      {sessions.isError && <ErrorState onRetry={() => sessions.refetch()} />}
      {sessions.isSuccess && (
        <ul className="divide-y rounded-[var(--radius-md)] border">
          {sessions.data.map((session) => {
            const label = describeUserAgent(session.userAgent ?? '');
            const Icon = /Android|iOS/.test(label) ? Smartphone : Laptop;
            return (
              <li key={session.id} className="flex items-center gap-4 px-4 py-3">
                <Icon aria-hidden="true" className="text-muted-foreground size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {label}
                    {session.current && <Badge variant="secondary">Bu cihaz</Badge>}
                    {session.rememberMe && (
                      <span className="text-muted-foreground text-xs font-normal">7 gün</span>
                    )}
                  </p>
                  <p className="type-meta text-muted-foreground truncate">
                    {session.ipAddress ?? 'IP yok'} · son kullanım{' '}
                    <time dateTime={session.lastUsedAt} title={formatDateTime(session.lastUsedAt)}>
                      {formatRelative(session.lastUsedAt)}
                    </time>
                  </p>
                </div>
                {!session.current && (
                  <ConfirmButton
                    label="Sonlandır"
                    title="Oturum sonlandırılsın mı?"
                    description={`${label} cihazındaki oturum kapatılacak.`}
                    confirmLabel="Sonlandır"
                    onConfirm={() => revokeOne.mutate(session.id)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SettingsCard>
  );
}
