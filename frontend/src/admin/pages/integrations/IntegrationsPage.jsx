// Durumlar: Discord, Spotify, GitHub. Her kartta aç/kapa, yapılandırma, secret
// ("Ayarlı ✓ · Değiştir"; yalnızca SÜPER ADMİN), test, şimdi senkronize et, son başarı/hata ve
// gerçek public kart bileşeniyle önizleme.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, ExternalLink, KeyRound, RefreshCw, Unplug, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { DISCORD_MANUAL_LIMITS, hasPermission } from '@my-portfolyo/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { DiscordView, GithubView, SpotifyView } from '@/features/status/StatusCards.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { formatDateTime, formatRelative } from '@/lib/format.js';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SettingsCard } from '../../components/SettingsCard.jsx';
import { adminKeys, integrationsApi } from '../../lib/adminApi.js';

export const META = {
  discord: {
    title: 'Discord',
    description: 'Durum, aktivite ve avatar; bot aracılığıyla canlı (Gateway).',
    field: { name: 'userId', label: 'Kullanıcı ID', placeholder: '123456789012345678' },
    secrets: [{ name: 'botToken', label: 'Bot token' }],
    View: DiscordView,
  },
  spotify: {
    title: 'Spotify',
    description: 'Şu an çalan parça ve en çok dinlenenler; dakikada bir güncellenir.',
    field: { name: 'clientId', label: 'Client ID', placeholder: '32 karakter' },
    secrets: [{ name: 'clientSecret', label: 'Client Secret' }],
    View: SpotifyView,
  },
  github: {
    title: 'GitHub',
    description: 'Profil, depo/takipçi sayısı ve istatistik kartları; saatte bir güncellenir.',
    field: { name: 'username', label: 'Kullanıcı adı', placeholder: 'octocat' },
    secrets: [],
    View: GithubView,
  },
};

export const STATUS_LABELS = {
  CONNECTED: ['Bağlı', 'bg-success/15 text-success'],
  ERROR: ['Hata', 'bg-danger/15 text-danger'],
  DISCONNECTED: ['Bağlı değil', 'bg-muted text-muted-foreground'],
};

function StatusPill({ status }) {
  const [label, tone] = STATUS_LABELS[status] ?? STATUS_LABELS.DISCONNECTED;
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>{label}</span>
  );
}

function CopyButton({ value, label }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error('Kopyalanamadı.');
        }
      }}
    >
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
    </Button>
  );
}

/** "Ayarlı ✓ · Değiştir" deseni: değer hiçbir zaman gösterilmez. */
export function SecretField({ label, isSet, canEdit, onSave, pending }) {
  const [editing, setEditing] = useState(!isSet);
  const [value, setValue] = useState('');
  useEffect(() => {
    setEditing(!isSet);
    setValue('');
  }, [isSet]);

  if (!canEdit) {
    return (
      <p className="text-sm">
        <span className="font-medium">{label}:</span>{' '}
        <span className="text-muted-foreground">{isSet ? 'Ayarlı ✓' : 'Ayarlanmamış'}</span>
        <span className="text-muted-foreground block text-xs">
          Yalnızca süper admin değiştirebilir.
        </span>
      </p>
    );
  }
  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-medium">{label}:</span>{' '}
          <span className="text-success">Ayarlı ✓</span>
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
          Değiştir
        </Button>
      </div>
    );
  }
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSave(value.trim());
      }}
    >
      <FormField label={label} className="flex-1">
        <Input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </FormField>
      <Button type="submit" disabled={pending || !value.trim()}>
        <KeyRound aria-hidden="true" />
        Kaydet
      </Button>
      {isSet && (
        <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
          Vazgeç
        </Button>
      )}
    </form>
  );
}

/** Discord bot API'sinin vermediği alanlar: profil kartında gösterilmek üzere elle girilir. */
function DiscordManualFields({ item, canEdit }) {
  const queryClient = useQueryClient();
  const [pronouns, setPronouns] = useState(item.config?.pronouns ?? '');
  const save = useMutation({
    mutationFn: () => integrationsApi.update('discord', { config: { pronouns } }),
    onSuccess: () => {
      toast.success('Hitap şekli kaydedildi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.integrations });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return (
    <form
      className="grid gap-3 rounded-[var(--radius-md)] border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-muted-foreground text-xs">
        Discord bot API&apos;si hitap şeklini vermez; kartta görünmesi için buraya yaz.
      </p>
      <FormField label="Hitap şekli (zamirler)">
        <Input
          value={pronouns}
          maxLength={DISCORD_MANUAL_LIMITS.pronouns}
          disabled={!canEdit}
          placeholder="o/onu"
          onChange={(e) => setPronouns(e.target.value)}
        />
      </FormField>
      <Button
        type="submit"
        variant="outline"
        className="w-fit"
        disabled={!canEdit || save.isPending}
      >
        Hitap şeklini kaydet
      </Button>
    </form>
  );
}

function IntegrationCard({ item, canEdit, canSuper }) {
  const queryClient = useQueryClient();
  const meta = META[item.provider];
  const [fieldValue, setFieldValue] = useState(item.config?.[meta.field.name] ?? '');
  const [fieldError, setFieldError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    setFieldValue(item.config?.[meta.field.name] ?? '');
  }, [item.config, meta.field.name]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.integrations });
  const onError = (error) => toast.error(getErrorMessage(error));

  const update = useMutation({
    mutationFn: (body) => integrationsApi.update(item.provider, body),
    onSuccess: (_d, body) => {
      setFieldError(null);
      refresh();
      if (body.config) toast.success('Kaydedildi.');
    },
    onError: (error) => {
      const detail = error?.response?.data?.error?.details?.[0];
      if (detail?.path?.startsWith('config.')) setFieldError(detail.message);
      else onError(error);
    },
  });
  const secrets = useMutation({
    mutationFn: (body) => integrationsApi.setSecrets(item.provider, body),
    onSuccess: () => {
      toast.success('Secret kaydedildi.');
      refresh();
    },
    onError,
  });
  const run = useMutation({
    mutationFn: (kind) => integrationsApi[kind](item.provider),
    onSuccess: (data) => {
      setResult(data);
      refresh();
    },
    onError,
  });
  const authorize = useMutation({
    mutationFn: integrationsApi.spotifyAuthorize,
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
    onError,
  });
  const disconnect = useMutation({
    mutationFn: integrationsApi.spotifyDisconnect,
    onSuccess: () => {
      toast.success('Spotify bağlantısı kesildi.');
      refresh();
    },
    onError,
  });

  const View = meta.View;
  const configured = Boolean(item.config?.[meta.field.name]);
  const switchId = `integration-${item.provider}`;

  return (
    <SettingsCard
      title={meta.title}
      description={meta.description}
      footer={
        <>
          {result && (
            <p
              role="status"
              className={cn('mr-auto text-sm', result.ok ? 'text-success' : 'text-danger')}
            >
              {result.message}
            </p>
          )}
          <Button
            variant="outline"
            disabled={!canEdit || run.isPending}
            onClick={() => run.mutate('test')}
          >
            <Zap aria-hidden="true" />
            Bağlantıyı test et
          </Button>
          <Button
            disabled={!canEdit || run.isPending || !item.isEnabled}
            onClick={() => run.mutate('sync')}
          >
            <RefreshCw aria-hidden="true" className={cn(run.isPending && 'animate-spin')} />
            Şimdi senkronize et
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
        <div className="grid content-start gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Switch
                id={switchId}
                checked={item.isEnabled}
                disabled={!canEdit || update.isPending}
                onCheckedChange={(isEnabled) => update.mutate({ isEnabled })}
              />
              <Label htmlFor={switchId} className="font-normal">
                {item.isEnabled ? 'Public sayfada açık' : 'Kapalı (kart görünmez)'}
              </Label>
            </div>
            <StatusPill status={item.status} />
          </div>

          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({ config: { [meta.field.name]: fieldValue.trim() } });
            }}
          >
            <FormField label={meta.field.label} error={fieldError ?? undefined} className="flex-1">
              <Input
                value={fieldValue}
                placeholder={meta.field.placeholder}
                disabled={!canEdit}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => setFieldValue(e.target.value)}
              />
            </FormField>
            <Button type="submit" variant="outline" disabled={!canEdit || update.isPending}>
              Kaydet
            </Button>
          </form>

          {meta.secrets.map((s) => (
            <SecretField
              key={s.name}
              label={s.label}
              isSet={item.secrets?.[s.name]?.isSet}
              canEdit={canSuper}
              pending={secrets.isPending}
              onSave={(value) => secrets.mutate({ [s.name]: value })}
            />
          ))}

          {item.provider === 'discord' && <DiscordManualFields item={item} canEdit={canEdit} />}

          {item.provider === 'discord' && (
            <p className="text-muted-foreground text-xs leading-relaxed">
              Kurulum: Developer Portal &gt; Bot&apos;ta <strong>Server Members</strong> ve{' '}
              <strong>Presence</strong> intent&apos;lerini aç (ses kanalı için ek ayar gerekmez);
              botu, senin de üyesi olduğun bir sunucuya ekle. Kullanıcı ID için Discord&apos;da
              Geliştirici Modu &gt; profiline sağ tık &gt; ID&apos;yi kopyala.
            </p>
          )}

          {item.provider === 'spotify' && item.spotify && (
            <div className="grid gap-3">
              <FormField label="Redirect URI (Spotify uygulamasına ekle)">
                <div className="flex gap-2">
                  <Input readOnly value={item.spotify.redirectUri} className="font-mono text-xs" />
                  <CopyButton value={item.spotify.redirectUri} label="Redirect URI'yi kopyala" />
                </div>
              </FormField>
              <div className="flex flex-wrap items-center gap-2">
                {item.spotify.connected ? (
                  <Button
                    variant="outline"
                    disabled={!canSuper || disconnect.isPending}
                    onClick={() => disconnect.mutate()}
                  >
                    <Unplug aria-hidden="true" />
                    Bağlantıyı kes
                  </Button>
                ) : (
                  <Button
                    disabled={
                      !canSuper ||
                      authorize.isPending ||
                      !configured ||
                      !item.secrets?.clientSecret?.isSet
                    }
                    onClick={() => authorize.mutate()}
                  >
                    <ExternalLink aria-hidden="true" />
                    Spotify ile bağlan
                  </Button>
                )}
                <span className="text-muted-foreground text-xs">
                  {item.spotify.connected
                    ? `Bağlı · izinler: ${item.spotify.grantedScopes.join(', ') || '—'}`
                    : 'Önce Client ID ve Secret kaydet.'}
                </span>
              </div>
            </div>
          )}

          <dl className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt>Son başarılı güncelleme</dt>
            <dd title={formatDateTime(item.lastSuccessAt)}>
              {item.lastSuccessAt ? formatRelative(item.lastSuccessAt) : '—'}
            </dd>
            <dt>Son deneme</dt>
            <dd title={formatDateTime(item.lastSyncAt)}>
              {item.lastSyncAt ? formatRelative(item.lastSyncAt) : '—'}
            </dd>
          </dl>
          {item.lastError && (
            <div className="border-danger/35 bg-danger/10 text-danger flex items-start justify-between gap-2 rounded-[var(--radius-md)] border p-3 text-sm">
              <p className="min-w-0 break-words">{item.lastError}</p>
              <CopyButton value={item.lastError} label="Hatayı kopyala" />
            </div>
          )}
        </div>

        <div className="grid content-start gap-2">
          <p className="type-meta text-muted-foreground">Public kart önizlemesi</p>
          <div className="surface-chrome flex min-h-[200px] flex-col gap-3 rounded-[var(--radius-lg)] border p-5">
            {item.snapshot ? (
              <View
                data={item.snapshot}
                cards={
                  item.provider === 'github' && item.isEnabled
                    ? {
                        stats: '/api/public/status/github/cards/stats.svg',
                        streak: '/api/public/status/github/cards/streak.svg',
                      }
                    : undefined
                }
              />
            ) : (
              <p className="text-muted-foreground m-auto text-center text-sm">
                Henüz veri yok. Ayarları kaydedip “Şimdi senkronize et”e bas.
              </p>
            )}
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

const SPOTIFY_RESULTS = {
  connected: ['success', 'Spotify bağlandı.'],
  denied: ['error', 'Spotify izni verilmedi.'],
  invalid_state: ['error', 'Bağlantı isteği geçersiz ya da süresi doldu; tekrar dene.'],
  error: ['error', 'Spotify bağlantısı tamamlanamadı.'],
};

export function IntegrationsPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'status:write');
  const canSuper = admin?.role === 'SUPER_ADMIN';
  const query = useQuery({ queryKey: adminKeys.integrations, queryFn: integrationsApi.list });
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    document.title = 'Durumlar · Yönetim';
  }, []);

  useEffect(() => {
    const result = SPOTIFY_RESULTS[params.get('spotify')];
    if (!result) return;
    toast[result[0]](result[1]);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('spotify');
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  return (
    <>
      <PageHeader
        title="Durumlar"
        description="Ana sayfadaki Discord, Spotify ve GitHub kartları. Veriler sunucuda çekilir; ziyaretçi dış servislere istek atmaz."
      />
      {query.isPending && (
        <div className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      )}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {query.data && (
        <div className="grid gap-6">
          {query.data.map((item) => (
            <IntegrationCard
              key={item.provider}
              item={item}
              canEdit={canEdit}
              canSuper={canSuper}
            />
          ))}
        </div>
      )}
    </>
  );
}
