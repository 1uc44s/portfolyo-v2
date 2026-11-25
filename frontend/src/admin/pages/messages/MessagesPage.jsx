// iki panelli gelen kutusu. Seçili mesaj URL'de (`?id=`), görünüm
// `?view=`. Klavye: j/k gezin, e yanıtlandı ↔ bekliyor, s spam (yazma alanı odaktayken devre dışı).
// Mobilde tek sütun: liste ya da detay (geri butonu).
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Ban,
  CheckCheck,
  Inbox,
  Mail,
  MailOpen,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { CONTACT_VIEWS, hasPermission } from '@my-portfolyo/shared';
import { EmptyState } from '@/components/common/EmptyState.jsx';
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
} from '@/components/ui/alert-dialog.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { formatDateTime, formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../components/PageHeader.jsx';
import { adminKeys, messagesApi } from '../../lib/adminApi.js';

export const VIEW_LABELS = {
  inbox: 'Gelen',
  unread: 'Okunmamış',
  pending: 'Bekliyor',
  replied: 'Yanıtlandı',
  spam: 'Spam',
};
const PAGE_SIZE = 50;

/** Kısayolların yazma alanlarında çalışmaması için. */
export const isTypingTarget = (el) =>
  Boolean(el?.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]'));

function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function StatusBadges({ message }) {
  return (
    <span className="flex flex-wrap gap-1">
      {message.isSpam && (
        <span className="bg-danger/15 text-danger rounded-full px-2 py-0.5 text-[11px] font-medium">
          Spam
        </span>
      )}
      <span
        className={cn(
          'rounded-full px-2 py-0.5 text-[11px] font-medium',
          message.status === 'REPLIED'
            ? 'bg-success/15 text-success'
            : 'bg-muted text-muted-foreground',
        )}
      >
        {message.status === 'REPLIED' ? 'Yanıtlandı' : 'Bekliyor'}
      </span>
    </span>
  );
}

function MessageList({ items, selectedId, onSelect }) {
  return (
    <ul aria-label="Mesajlar" className="divide-border divide-y">
      {items.map((m) => {
        const selected = m.id === selectedId;
        return (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onSelect(m.id)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'focus-visible:ring-ring/50 grid w-full gap-1 px-4 py-3 text-left transition-colors outline-none focus-visible:ring-[3px]',
                selected ? 'bg-primary-soft' : 'hover:bg-accent',
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className={cn('truncate', !m.isRead && 'font-semibold')}>
                  {!m.isRead && (
                    <span
                      aria-hidden="true"
                      className="bg-primary mr-2 inline-block size-2 rounded-full align-middle"
                    />
                  )}
                  {m.firstName} {m.lastName}
                  {!m.isRead && <span className="sr-only"> (okunmamış)</span>}
                </span>
                <time
                  dateTime={m.createdAt}
                  title={formatDateTime(m.createdAt)}
                  className="text-muted-foreground shrink-0 text-xs"
                >
                  {formatRelative(m.createdAt)}
                </time>
              </span>
              <span className={cn('truncate text-sm', !m.isRead && 'font-medium')}>
                {m.subject}
              </span>
              <span className="text-muted-foreground line-clamp-1 text-xs">{m.preview}</span>
              <StatusBadges message={m} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DeleteMessageDialog({ message, onClose, onDeleted }) {
  const remove = useMutation({
    mutationFn: () => messagesApi.remove(message.id),
    onSuccess: () => {
      toast.success('Mesaj silindi.');
      onDeleted();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <AlertDialog open={Boolean(message)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mesaj kalıcı olarak silinsin mi?</AlertDialogTitle>
          <AlertDialogDescription>
            “{message?.subject}” konulu mesaj ve gönderen bilgileri silinir; geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.isPending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.isPending}
            onClick={(event) => {
              event.preventDefault();
              remove.mutate();
            }}
          >
            {remove.isPending ? 'Siliniyor…' : 'Sil'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function MessageDetail({ id, canEdit, onBack, onDeleted, onUpdate, updating }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: adminKeys.message(id), queryFn: () => messagesApi.open(id) });
  const [deleting, setDeleting] = useState(null);
  const message = query.data;

  // Açınca okundu: liste ve rozet tazelenir.
  useEffect(() => {
    if (!query.isSuccess) return;
    queryClient.invalidateQueries({ queryKey: adminKeys.unreadCount });
    queryClient.invalidateQueries({ queryKey: adminKeys.messages() });
  }, [query.isSuccess, id, queryClient]);

  const reply = useMutation({
    mutationFn: () => messagesApi.replyLinks(id),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const openReply = async () => {
    const links = reply.data ?? (await reply.mutateAsync());
    if (links?.mailto) window.location.href = links.mailto;
  };

  if (query.isPending) {
    return (
      <div className="grid gap-3 p-6" aria-busy="true">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (query.isError) return <ErrorState onRetry={() => query.refetch()} />;

  const replied = message.status === 'REPLIED';
  return (
    <article aria-labelledby="message-subject" className="grid gap-6 p-5 sm:p-6">
      <div className="grid gap-3">
        <Button variant="ghost" size="sm" className="w-fit lg:hidden" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          Mesajlara dön
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 id="message-subject" className="type-h3 text-pretty">
            {message.subject}
          </h2>
          <StatusBadges message={message} />
        </div>
        <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-4">
          <dt className="font-medium">Gönderen</dt>
          <dd className="text-foreground">
            {message.firstName} {message.lastName}
          </dd>
          <dt className="font-medium">E-posta</dt>
          <dd>
            <a
              className="text-foreground underline-offset-4 hover:underline"
              href={`mailto:${message.email}`}
            >
              {message.email}
            </a>
          </dd>
          {/* Telefon opsiyonel: girilmemişse satır hiç gösterilmez. */}
          {message.phone && (
            <>
              <dt className="font-medium">Telefon</dt>
              <dd>
                <a
                  className="text-foreground underline-offset-4 hover:underline"
                  href={`tel:${message.phone}`}
                >
                  {message.phone}
                </a>
              </dd>
            </>
          )}
          <dt className="font-medium">Tarih</dt>
          <dd>
            <time dateTime={message.createdAt}>{formatDateTime(message.createdAt)}</time>
          </dd>
        </dl>
      </div>

      <div className="bg-muted/40 rounded-[var(--radius-md)] border p-4 text-sm leading-relaxed break-words whitespace-pre-wrap">
        {message.message}
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={openReply} disabled={reply.isPending}>
            <Mail aria-hidden="true" />
            E-posta ile yanıtla
          </Button>
          <Button
            variant="outline"
            disabled={updating}
            onClick={() => onUpdate(message, { status: replied ? 'PENDING' : 'REPLIED' })}
            aria-keyshortcuts="e"
          >
            {replied ? <RotateCcw aria-hidden="true" /> : <CheckCheck aria-hidden="true" />}
            {replied ? 'Bekliyor olarak işaretle' : 'Yanıtlandı olarak işaretle'}
          </Button>
          <Button
            variant="outline"
            disabled={updating}
            onClick={() => onUpdate(message, { isSpam: !message.isSpam })}
            aria-keyshortcuts="s"
          >
            <Ban aria-hidden="true" />
            {message.isSpam ? 'Spam değil' : 'Spam işaretle'}
          </Button>
          <Button
            variant="ghost"
            disabled={updating}
            onClick={() => {
              onUpdate(message, { isRead: false });
              onBack();
            }}
          >
            <MailOpen aria-hidden="true" />
            Okunmadı yap
          </Button>
          <Button variant="ghost" className="text-danger" onClick={() => setDeleting(message)}>
            <Trash2 aria-hidden="true" />
            Sil
          </Button>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        E-posta ile yanıtlamak durumu değiştirmez; gönderdikten sonra “Yanıtlandı” olarak işaretle.
        Bu mesaj {formatDateTime(message.retentionUntil)} tarihinde otomatik silinir.
      </p>
      <DeleteMessageDialog
        message={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          onDeleted(message.id);
        }}
      />
    </article>
  );
}

export function MessagesPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'messages:write');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const view = CONTACT_VIEWS.includes(params.get('view')) ? params.get('view') : 'inbox';
  const selectedId = params.get('id');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const listParams = useMemo(
    () => ({ view, page, limit: PAGE_SIZE, ...(q ? { q } : {}) }),
    [view, page, q],
  );
  const list = useQuery({
    queryKey: adminKeys.messages(listParams),
    queryFn: () => messagesApi.list(listParams),
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => list.data?.data ?? [], [list.data]);
  const total = list.data?.meta?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    document.title = 'İletişim Mesajları · Yönetim';
  }, []);

  const setParam = (changes) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v == null) next.delete(k);
          else next.set(k, v);
        }
        return next;
      },
      { replace: true },
    );
  const select = (id) => setParam({ id });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: adminKeys.messages() });
    queryClient.invalidateQueries({ queryKey: adminKeys.unreadCount });
  };

  const update = useMutation({
    mutationFn: ({ id, body }) => messagesApi.update(id, body),
    onSuccess: (data, { body }) => {
      // Okunmadı yapılan mesaj önbellekte kalmasın: tekrar açılınca sunucu yine okundu işaretler.
      if (body.isRead === false)
        queryClient.removeQueries({ queryKey: adminKeys.message(data.id) });
      else queryClient.setQueryData(adminKeys.message(data.id), data);
      refresh();
      if (body.status) toast.success(body.status === 'REPLIED' ? 'Yanıtlandı.' : 'Bekliyor.');
      if (body.isSpam !== undefined) {
        toast.success(body.isSpam ? 'Spam olarak işaretlendi.' : 'Spam işareti kaldırıldı.');
      }
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const onUpdate = (message, body) => update.mutate({ id: message.id, body });

  // Klavye kısayolları.
  useEffect(() => {
    const onKey = (event) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      const index = items.findIndex((m) => m.id === selectedId);
      if (event.key === 'j' || event.key === 'k') {
        if (items.length === 0) return;
        const step = event.key === 'j' ? 1 : -1;
        const next = index === -1 ? 0 : Math.min(items.length - 1, Math.max(0, index + step));
        event.preventDefault();
        select(items[next].id);
        return;
      }
      if (!canEdit || !selectedId || update.isPending) return;
      const current = queryClient.getQueryData(adminKeys.message(selectedId));
      if (!current) return;
      if (event.key === 'e') {
        event.preventDefault();
        onUpdate(current, { status: current.status === 'REPLIED' ? 'PENDING' : 'REPLIED' });
      } else if (event.key === 's') {
        event.preventDefault();
        onUpdate(current, { isSpam: !current.isSpam });
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <PageHeader
        title="İletişim Mesajları"
        description="Okunmamışlar önce gelir. Kısayollar: j / k gezin, e yanıtlandı, s spam."
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Görünüm" className="flex flex-wrap gap-1">
          {CONTACT_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => {
                setPage(1);
                setParam({ view: v === 'inbox' ? null : v, id: null });
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                view === v
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Ad, e-posta ya da konu ara"
            aria-label="Mesajlarda ara"
            className="pl-9"
          />
        </div>
      </div>

      <div className="bg-card grid min-h-[60dvh] overflow-hidden rounded-[var(--radius-lg)] border lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={cn('lg:border-r', selectedId && 'hidden lg:block')}>
          {list.isPending && (
            <div className="grid gap-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          )}
          {list.isError && <ErrorState onRetry={() => list.refetch()} />}
          {list.isSuccess && items.length === 0 && (
            <EmptyState
              icon={Inbox}
              title={q ? 'Aramayla eşleşen mesaj yok.' : 'Burada mesaj yok.'}
              description={
                q ? 'Farklı bir kelime dene.' : 'Yeni mesajlar geldiğinde burada görünecek.'
              }
            />
          )}
          {items.length > 0 && (
            <MessageList items={items} selectedId={selectedId} onSelect={select} />
          )}
          {pages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Önceki
              </Button>
              <span className="text-muted-foreground tabular-nums">
                {page} / {pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </div>
        <div className={cn(!selectedId && 'hidden lg:block')}>
          {selectedId ? (
            <MessageDetail
              key={selectedId}
              id={selectedId}
              canEdit={canEdit}
              updating={update.isPending}
              onUpdate={onUpdate}
              onBack={() => select(null)}
              onDeleted={(id) => {
                queryClient.removeQueries({ queryKey: adminKeys.message(id) });
                refresh();
                select(null);
              }}
            />
          ) : (
            <div className="text-muted-foreground grid h-full place-items-center p-10 text-center text-sm">
              Okumak için soldan bir mesaj seç.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
