// ADMIN.md §3.2 (12), SRS §6 FR-AUD-05 — Güvenlik ve İşlem Logları. Salt okunur liste; tarih aralığı,
// yönetici, eylem ve varlık türü filtreleri URL'de (`?from=&to=&adminId=&action=&entityType=&page=`).
// CSV dışa aktarma yalnızca SUPER_ADMIN (ROUTES.md §4.13).
import { Fragment, useState } from 'react';
import { useSearchParams } from 'react-router';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RotateCcw,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';
import { ROLES } from '@vasquez/shared';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { describeUserAgent, formatDateTime, formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../components/PageHeader.jsx';
import { adminKeys, auditApi } from '../../lib/adminApi.js';

const PAGE_SIZE = 50;
const ALL = '__all__';
const FILTER_KEYS = ['from', 'to', 'adminId', 'action', 'entityType'];

/** Bilinen eylem kodlarının Türkçe karşılıkları; bilinmeyen kod olduğu gibi gösterilir. */
export const ACTION_LABELS = {
  AUTH_LOGIN_SUCCESS: 'Giriş başarılı',
  AUTH_LOGIN_FAILED: 'Giriş başarısız',
  AUTH_LOGOUT: 'Çıkış',
  AUTH_2FA_FAILED: '2FA doğrulaması başarısız',
  AUTH_LOCKED: 'Hesap geçici kilitlendi',
  AUTH_LOCK_BYPASSED: 'Kilit temiz kaynaktan doğru şifreyle açıldı',
  AUTH_REAUTH_FAILED: 'Hesap doğrulaması başarısız (şifre/2FA)',
  UNKNOWN_ACCOUNT: 'Bilinmeyen hesapla giriş denemesi',
  RATE_LIMITED: 'İstek sınırı aşıldı',
  SESSION_REVOKED: 'Oturum sonlandırıldı',
  SESSION_REUSE_DETECTED: 'Token yeniden kullanımı tespit edildi',
  PASSWORD_CHANGED: 'Şifre değiştirildi',
  PASSWORD_RESET_REQUESTED: 'Şifre sıfırlama istendi',
  PASSWORD_RESET_COMPLETED: 'Şifre sıfırlandı',
  PASSWORD_RESET_SMTP_MISSING: 'Sıfırlama e-postası gönderilemedi (SMTP yok)',
  EMAIL_CHANGED: 'E-posta değiştirildi',
  '2FA_ENABLED': '2FA açıldı',
  '2FA_DISABLED': '2FA kapatıldı',
  '2FA_RECOVERY_REGENERATED': 'Kurtarma kodları yenilendi',
  '2FA_RESET_BY_ADMIN': '2FA yönetici tarafından sıfırlandı',
  ADMIN_CREATED: 'Yönetici oluşturuldu',
  ADMIN_UPDATED: 'Yönetici güncellendi',
  MEDIA_UPLOADED: 'Medya yüklendi',
  MEDIA_DELETED: 'Medya silindi',
  MEDIA_PROCESSING_FAILED: 'Medya işlenemedi',
  SETTINGS_UPDATED: 'Site ayarları güncellendi',
  HERO_UPDATED: 'Hero güncellendi',
  ABOUT_UPDATED: 'Hakkımda güncellendi',
  FAVICON_UPDATED: 'Favicon güncellendi',
  LEGAL_UPDATED: 'Yasal metin güncellendi',
  MAIL_SETTINGS_UPDATED: 'Mail ayarları güncellendi',
  SMTP_TESTED: 'SMTP test edildi',
  INTEGRATION_UPDATED: 'Entegrasyon güncellendi',
  ROTATION_OVERRIDE_SET: 'Rotasyon sabitlendi',
  ROTATION_OVERRIDE_CLEARED: 'Rotasyon sabitlemesi kaldırıldı',
  ROTATION_RESELECTED: 'Rotasyon yeniden seçildi',
  REORDERED: 'Sıralama değişti',
  CONTACT_RETENTION_PURGED: 'Eski mesajlar temizlendi',
  CONTACT_REPLY_LINK_OPENED: 'Mesaja yanıt açıldı',
  AUDIT_EXPORTED: 'Loglar dışa aktarıldı',
};

/** Varlık türü (entityType) etiketleri. */
export const ENTITY_LABELS = {
  AboutContent: 'Hakkımda',
  AdminSession: 'Oturum',
  AdminUser: 'Yönetici',
  Background: 'Arka plan',
  Category: 'Kategori',
  ContactMessage: 'İletişim mesajı',
  ContentOverride: 'Rotasyon sabitlemesi',
  CursorSet: 'Cursor seti',
  DailyContentSelection: 'Günlük seçim',
  FallingItem: 'Yağan öğe',
  HeroSettings: 'Hero',
  IntegrationSetting: 'Entegrasyon',
  LegalDocument: 'Yasal metin',
  LinkItem: 'Link',
  MediaAsset: 'Medya dosyası',
  Music: 'Müzik',
  NameOverlay: 'İsim efekti',
  ProfileMedia: 'Profil fotoğrafı',
  Project: 'Proje',
  SiteSettings: 'Site ayarları',
  TechStack: 'Tech Stack',
  audit_log: 'Audit log',
};

/** Önek + fiil biçimindeki kodlar (ör. MUSIC_CREATED, IMAGE_REPLACED). */
const PREFIX_LABELS = {
  BACKGROUND: 'Arka plan',
  MUSIC: 'Müzik',
  PROFILE_MEDIA: 'Profil fotoğrafı',
  CURSOR_SET: 'Cursor seti',
  NAME_OVERLAY: 'İsim efekti',
  FALLING_ITEM: 'Yağan öğe',
  TECH_STACK_ITEM: 'Tech Stack öğesi',
  TECH_STACK: 'Tech Stack',
  CONTACT_MESSAGE: 'İletişim mesajı',
  INTEGRATION_SECRET: 'Entegrasyon secret’ı',
  INTEGRATION: 'Entegrasyon',
  IMAGES: 'Proje görselleri',
  IMAGE: 'Proje görseli',
};
const VERB_LABELS = {
  CREATED: 'oluşturuldu',
  UPDATED: 'güncellendi',
  DELETED: 'silindi',
  REORDERED: 'yeniden sıralandı',
  REPLACED: 'değiştirildi',
  ADDED: 'eklendi',
  TOGGLED: 'açıldı/kapatıldı',
  TESTED: 'test edildi',
  CONNECTED: 'bağlandı',
  DISCONNECTED: 'bağlantısı kesildi',
};
const capitalize = (text) => text.charAt(0).toLocaleUpperCase('tr-TR') + text.slice(1);

/** Güvenlik açısından dikkat isteyen eylemler kırmızı rozetle gösterilir. */
const DANGER = /FAILED|LOCKED|REUSE|UNKNOWN|RATE_LIMITED|DISABLED|DELETED/;

/** Tam eşleşme → önek+fiil → genel fiil + varlık türü → ham kod. */
export function actionLabel(code, entityType) {
  if (ACTION_LABELS[code]) return ACTION_LABELS[code];
  if (VERB_LABELS[code]) {
    const entity = ENTITY_LABELS[entityType];
    return entity ? `${entity} ${VERB_LABELS[code]}` : capitalize(VERB_LABELS[code]);
  }
  const verb = Object.keys(VERB_LABELS).find((v) => code.endsWith(`_${v}`));
  const prefix = verb && code.slice(0, -(verb.length + 1));
  if (prefix && PREFIX_LABELS[prefix]) return `${PREFIX_LABELS[prefix]} ${VERB_LABELS[verb]}`;
  return code;
}

const entityLabel = (type) => (type ? (ENTITY_LABELS[type] ?? type) : '—');
const actorLabel = (actor) => actor?.displayName || actor?.email || 'Sistem';

/** "2026-11-17" (yerel gün) → gün başı / gün sonu ISO. */
function dayBoundary(day, endOfDay) {
  if (!day) return undefined;
  const [y, m, d] = day.split('-').map(Number);
  const date = endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function apiFilters(filters) {
  return {
    from: dayBoundary(filters.from, false),
    to: dayBoundary(filters.to, true),
    adminId: filters.adminId || undefined,
    action: filters.action || undefined,
    entityType: filters.entityType || undefined,
  };
}

function FilterSelect({ id, label, value, onChange, options }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || ALL} onValueChange={(v) => onChange(v === ALL ? '' : v)}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Tümü</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Filters({ filters, setFilter, reset, options, invalidRange }) {
  const active = FILTER_KEYS.some((k) => filters[k]);
  return (
    <section
      aria-label="Filtreler"
      className="mb-6 grid gap-4 rounded-[var(--radius-lg)] border p-4 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end"
    >
      <div className="grid min-w-0 gap-1.5">
        <Label htmlFor="audit-from">Başlangıç</Label>
        <Input
          id="audit-from"
          type="date"
          value={filters.from}
          max={filters.to || undefined}
          onChange={(e) => setFilter('from', e.target.value)}
          aria-invalid={invalidRange || undefined}
        />
      </div>
      <div className="grid min-w-0 gap-1.5">
        <Label htmlFor="audit-to">Bitiş</Label>
        <Input
          id="audit-to"
          type="date"
          value={filters.to}
          min={filters.from || undefined}
          onChange={(e) => setFilter('to', e.target.value)}
          aria-invalid={invalidRange || undefined}
        />
      </div>
      <FilterSelect
        id="audit-admin"
        label="Yönetici"
        value={filters.adminId}
        onChange={(v) => setFilter('adminId', v)}
        options={(options?.admins ?? []).map((a) => ({
          value: a.id,
          label: a.displayName ? `${a.displayName} (${a.email})` : a.email,
        }))}
      />
      <FilterSelect
        id="audit-action"
        label="Eylem"
        value={filters.action}
        onChange={(v) => setFilter('action', v)}
        options={(options?.actions ?? []).map((a) => ({ value: a, label: actionLabel(a) }))}
      />
      <FilterSelect
        id="audit-entity"
        label="Varlık türü"
        value={filters.entityType}
        onChange={(v) => setFilter('entityType', v)}
        options={(options?.entityTypes ?? []).map((e) => ({ value: e, label: entityLabel(e) }))}
      />
      <Button variant="ghost" onClick={reset} disabled={!active} className="justify-self-start">
        <RotateCcw aria-hidden="true" />
        Temizle
      </Button>
      {invalidRange && (
        <p role="alert" className="text-danger text-xs font-medium sm:col-span-2 lg:col-span-6">
          Başlangıç tarihi bitişten sonra olamaz.
        </p>
      )}
    </section>
  );
}

function ActionBadge({ action, entityType }) {
  const label = actionLabel(action, entityType);
  return (
    <span className="grid min-w-0 gap-0.5">
      <span
        className={cn(
          'w-fit rounded-full px-2 py-0.5 text-xs font-medium',
          DANGER.test(action) ? 'bg-danger/15 text-danger' : 'bg-muted text-foreground',
        )}
      >
        {label}
      </span>
      {label !== action && (
        <span className="text-muted-foreground font-mono text-[11px]">{action}</span>
      )}
    </span>
  );
}

function LogDetail({ log }) {
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
      <dt className="text-muted-foreground font-medium">Kayıt no</dt>
      <dd className="font-mono text-xs">{log.id}</dd>
      <dt className="text-muted-foreground font-medium">Zaman</dt>
      <dd>
        <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
      </dd>
      <dt className="text-muted-foreground font-medium">Yönetici</dt>
      <dd className="break-all">{log.actor ? log.actor.email : 'Sistem (otomatik iş / CLI)'}</dd>
      {log.entityId && (
        <>
          <dt className="text-muted-foreground font-medium">Varlık</dt>
          <dd className="font-mono text-xs break-all">
            {entityLabel(log.entityType)} · {log.entityId}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground font-medium">IP adresi</dt>
      <dd className="font-mono text-xs">{log.ipAddress ?? '—'}</dd>
      <dt className="text-muted-foreground font-medium">Tarayıcı</dt>
      <dd className="text-xs break-words">
        {log.userAgent ? `${describeUserAgent(log.userAgent)} — ${log.userAgent}` : '—'}
      </dd>
      <dt className="text-muted-foreground font-medium">Ayrıntı</dt>
      <dd className="min-w-0">
        {hasMetadata ? (
          <pre className="bg-muted/40 max-h-64 overflow-auto rounded-[var(--radius-md)] border p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        ) : (
          '—'
        )}
      </dd>
    </dl>
  );
}

function LogTable({ items }) {
  const [openId, setOpenId] = useState(null);
  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border">
      <table className="w-full min-w-[720px] text-sm">
        <caption className="sr-only">İşlem kayıtları, en yeni üstte</caption>
        <thead className="bg-muted/40 text-muted-foreground text-left text-xs">
          <tr>
            <th scope="col" className="w-10 px-3 py-2.5">
              <span className="sr-only">Ayrıntı</span>
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Zaman
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Yönetici
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Eylem
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              Varlık
            </th>
            <th scope="col" className="px-3 py-2.5 font-medium">
              IP
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {items.map((log) => {
            const open = openId === log.id;
            const detailId = `audit-detail-${log.id}`;
            return (
              <Fragment key={log.id}>
                <tr className={cn('align-top', open ? 'bg-primary-soft' : 'hover:bg-accent/50')}>
                  <td className="px-3 py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-expanded={open}
                      aria-controls={open ? detailId : undefined}
                      aria-label={open ? 'Ayrıntıyı gizle' : 'Ayrıntıyı göster'}
                      onClick={() => setOpenId(open ? null : log.id)}
                    >
                      <ChevronDown
                        aria-hidden="true"
                        className={cn('transition-transform', open && 'rotate-180')}
                      />
                    </Button>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <time dateTime={log.createdAt}>{formatDateTime(log.createdAt)}</time>
                    <span className="text-muted-foreground block text-xs">
                      {formatRelative(log.createdAt)}
                    </span>
                  </td>
                  <td className="max-w-[14rem] px-3 py-2.5">
                    <span className="block truncate" title={log.actor?.email}>
                      {actorLabel(log.actor)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <ActionBadge action={log.action} entityType={log.entityType} />
                  </td>
                  <td className="text-muted-foreground max-w-[12rem] px-3 py-2.5">
                    <span className="block truncate" title={log.entityId ?? undefined}>
                      {entityLabel(log.entityType)}
                    </span>
                  </td>
                  <td className="text-muted-foreground px-3 py-2.5 font-mono text-xs">
                    {log.ipAddress ?? '—'}
                  </td>
                </tr>
                {open && (
                  <tr id={detailId} className="bg-muted/20">
                    <td />
                    <td colSpan={5} className="px-3 py-4">
                      <LogDetail log={log} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ meta, onPage, fetching }) {
  const pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  const first = meta.total === 0 ? 0 : (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  return (
    <nav aria-label="Sayfalama" className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {meta.total.toLocaleString('tr-TR')} kayıttan {first}–{last} gösteriliyor
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page <= 1 || fetching}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft aria-hidden="true" />
          Önceki
        </Button>
        <span className="text-sm tabular-nums">
          {meta.page} / {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= pages || fetching}
          onClick={() => onPage(meta.page + 1)}
        >
          Sonraki
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AuditLogPage() {
  const admin = useAuthStore((s) => s.admin);
  const isSuper = admin?.role === ROLES.SUPER_ADMIN;
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = Object.fromEntries(FILTER_KEYS.map((k) => [k, searchParams.get(k) ?? '']));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const params = { ...apiFilters(filters), page, limit: PAGE_SIZE };

  const options = useQuery({ queryKey: adminKeys.auditFilters, queryFn: auditApi.filters });
  const query = useQuery({
    queryKey: adminKeys.audit(params),
    queryFn: () => auditApi.list(params),
    placeholderData: keepPreviousData,
    enabled: !invalidRange,
  });

  const exportCsv = useMutation({
    mutationFn: () => auditApi.exportCsv(apiFilters(filters)),
    onSuccess: (blob) => {
      saveBlob(blob, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success('CSV indirildi (en fazla 50 000 kayıt).');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const update = (changes) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, String(v));
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );

  const setFilter = (key, value) => update({ [key]: value, page: null });
  const reset = () => update(Object.fromEntries([...FILTER_KEYS, 'page'].map((k) => [k, null])));
  const hasFilters = FILTER_KEYS.some((k) => filters[k]);

  let body = null;
  if (invalidRange) body = null;
  else if (query.isPending) {
    body = (
      <div className="grid gap-2" aria-busy="true">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  } else if (query.isError) {
    body = <ErrorState onRetry={() => query.refetch()} />;
  } else if (query.data.data.length === 0) {
    body = (
      <EmptyState
        icon={ScrollText}
        title={hasFilters ? 'Filtrelere uyan kayıt yok' : 'Henüz kayıt yok'}
        description={
          hasFilters
            ? 'Tarih aralığını genişletmeyi ya da filtreleri temizlemeyi dene.'
            : 'Panelde işlem yapıldıkça burada listelenir.'
        }
        action={
          hasFilters && (
            <Button variant="outline" onClick={reset}>
              Filtreleri temizle
            </Button>
          )
        }
      />
    );
  } else {
    body = (
      <div className={cn('transition-opacity', query.isFetching && 'opacity-70')}>
        <LogTable items={query.data.data} />
        <Pagination
          meta={query.data.meta}
          fetching={query.isFetching}
          onPage={(p) => {
            update({ page: p > 1 ? p : null });
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Güvenlik ve İşlem Logları"
        description="Panelde yapılan işlemler ve güvenlik olayları (giriş denemeleri, şifre/2FA değişiklikleri, içerik düzenlemeleri). Kayıtlar değiştirilemez, 24 ay saklanır; hassas alanlar kayıt anında gizlenir."
        actions={
          isSuper && (
            <Button
              variant="outline"
              onClick={() => exportCsv.mutate()}
              disabled={exportCsv.isPending || invalidRange}
            >
              <Download aria-hidden="true" />
              {exportCsv.isPending ? 'Hazırlanıyor…' : 'CSV dışa aktar'}
            </Button>
          )
        }
      />
      <Filters
        filters={filters}
        setFilter={setFilter}
        reset={reset}
        options={options.data}
        invalidRange={invalidRange}
      />
      {body}
    </>
  );
}
