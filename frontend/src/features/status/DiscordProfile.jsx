// FR-INT-D (2026-11-16) — Discord profil kartı: banner/vurgu rengi, avatar + dekorasyon + durum, isim,
// kullanıcı adı, hitap şekli, sunucu etiketi, isim plakası, rozetler, özel durum (emoji)
// (Discord özel emoji sözdizimi `<:ad:id>` görsele çevrilir), etkinlikler (oyun, müzik, yayın, izleme)
// ve ses kanalı. Profil efekti / isim efekti-yazı stili bot API'sinde olmadığı için gösterilmez.
import { useEffect, useId, useState } from 'react';
import {
  Gamepad2,
  Headphones,
  Mic,
  MicOff,
  Radio,
  ShieldCheck,
  Trophy,
  Tv,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const PRESENCE_LABELS = {
  online: 'Çevrimiçi',
  idle: 'Boşta',
  dnd: 'Rahatsız etmeyin',
  offline: 'Çevrimdışı',
};
export const PRESENCE_DOT = {
  online: 'bg-status-online',
  idle: 'bg-status-idle',
  dnd: 'bg-status-dnd',
  offline: 'bg-status-offline',
};

const ACTIVITY_META = {
  PLAYING: { label: 'Oynuyor', icon: Gamepad2 },
  STREAMING: { label: 'Yayında', icon: Radio },
  LISTENING: { label: 'Dinliyor', icon: Headphones },
  WATCHING: { label: 'İzliyor', icon: Tv },
  COMPETING: { label: 'Yarışıyor', icon: Trophy },
};

const EMOJI = /<(a?):([\w~]{1,32}):(\d{17,20})>/g;

/** Metindeki Discord özel emojilerini görsele çevirir; geri kalan düz metin (HTML yok). */
export function DiscordText({ text, className }) {
  if (!text) return null;
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(EMOJI)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, animated, name, id] = m;
    parts.push(
      <img
        key={`${id}-${m.index}`}
        src={`https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=48`}
        alt={`:${name}:`}
        title={`:${name}:`}
        className="inline-block size-[1.25em] align-[-0.25em]"
        loading="lazy"
      />,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className={cn('break-words whitespace-pre-wrap', className)}>{parts}</span>;
}

/** Saniyede bir güncellenen "şimdi" (yalnızca zaman gösteren etkinlik varken). */
function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export const clock = (ms) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

const label =
  'text-muted-foreground flex items-center gap-1.5 text-[11px] font-semibold tracking-wide uppercase';
const box = 'bg-background/40 grid gap-2 rounded-[var(--radius-md)] border p-3';

function Activity({ activity, now }) {
  const meta = ACTIVITY_META[activity.type] ?? ACTIVITY_META.PLAYING;
  const Icon = meta.icon;
  const music = activity.type === 'LISTENING';
  const timedMusic = music && activity.startedAt && activity.endsAt;
  const elapsed = activity.startedAt ? now - activity.startedAt : null;
  const total = timedMusic ? activity.endsAt - activity.startedAt : null;
  const pct = timedMusic ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 0;
  return (
    <li className={box}>
      <p className={label}>
        <Icon aria-hidden="true" className="size-3.5" />
        {meta.label}
        {music ? ` · ${activity.name}` : ''}
      </p>
      <div className="flex items-center gap-3">
        {activity.largeImageUrl && (
          <span className="relative shrink-0">
            <img
              src={activity.largeImageUrl}
              alt={activity.largeText ?? ''}
              title={activity.largeText ?? undefined}
              loading="lazy"
              className="size-14 rounded-[var(--radius-sm)] object-cover"
            />
            {activity.smallImageUrl && (
              <img
                src={activity.smallImageUrl}
                alt=""
                loading="lazy"
                className="ring-card absolute -right-1.5 -bottom-1.5 size-6 rounded-full ring-2"
              />
            )}
          </span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-semibold">
            {music ? (activity.details ?? activity.name) : activity.name}
          </p>
          {!music && activity.details && (
            <p className="text-muted-foreground truncate">{activity.details}</p>
          )}
          {activity.state && <p className="text-muted-foreground truncate">{activity.state}</p>}
          {!timedMusic && elapsed !== null && elapsed >= 0 && (
            <p className="text-muted-foreground text-xs tabular-nums">{clock(elapsed)} geçti</p>
          )}
        </div>
      </div>
      {timedMusic && (
        <div className="flex items-center gap-2 text-[11px] tabular-nums">
          <span className="text-muted-foreground">{clock(Math.min(elapsed, total))}</span>
          <div
            role="progressbar"
            aria-label="Parça ilerlemesi"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
            className="bg-muted h-1 flex-1 overflow-hidden rounded-full"
          >
            <div className="bg-foreground h-full rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-muted-foreground">{clock(total)}</span>
        </div>
      )}
      {activity.url && (
        <a
          href={activity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline underline-offset-4"
        >
          Yayını izle
        </a>
      )}
    </li>
  );
}

// Discord CDN rozet ikonları (bilinen public flag hash'leri). Yüklenemezse metin çipine düşer.
const BADGE_ICONS = {
  Staff: '5e74e9b61934fc1f67c65515d1f7e60d',
  Partner: '3f9748e53446a137a052f3454e2de41e',
  Hypesquad: 'bf01d1073931f921909045f3a39fd264',
  BugHunterLevel1: '2717692c7dca7289b35297368a940dd0',
  BugHunterLevel2: '848f79194d4be5ff5f81505cbd0ce1e6',
  HypeSquadOnlineHouse1: '8a88d63823d8a71cd5e390baa45efa02',
  HypeSquadOnlineHouse2: '011940fd013da3f7fb926e4a1cd2e618',
  HypeSquadOnlineHouse3: '3aa41de486fa12454c3761e8e223442e',
  PremiumEarlySupporter: '7060786766c9c840eb3019e725d2b358',
  VerifiedDeveloper: '6df5892e0f35b051f8b61eace34f4967',
  CertifiedModerator: 'fee1624003e2fee35cb398e125dc479b',
  ActiveDeveloper: '6bdc42827a38498929a4920da12695d9',
};
const MAX_BADGES = 6;

function Badge({ badge }) {
  const [broken, setBroken] = useState(false);
  const hash = BADGE_ICONS[badge.id];
  if (!hash || broken) {
    return (
      <li
        title={badge.label}
        className="bg-muted inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-medium"
      >
        <ShieldCheck aria-hidden="true" className="size-3" />
        {badge.label}
      </li>
    );
  }
  return (
    <li className="grid size-6 place-items-center" title={badge.label}>
      <img
        src={`https://cdn.discordapp.com/badge-icons/${hash}.png`}
        alt={badge.label}
        width={22}
        height={22}
        loading="lazy"
        onError={() => setBroken(true)}
        className="size-[22px]"
      />
    </li>
  );
}

const STATUS_COLOR = {
  online: 'var(--status-online)',
  idle: 'var(--status-idle)',
  dnd: 'var(--status-dnd)',
  offline: 'var(--status-offline)',
};

/** Discord'un durum simgesi: çevrimiçi dolu, boşta hilal, rahatsız etmeyin çizgi, çevrimdışı halka. */
function StatusIcon({ status, maskId }) {
  return (
    <svg viewBox="0 0 24 24" className="absolute right-0 bottom-0 size-7" aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="var(--surface)" />
      <mask id={maskId}>
        <circle cx="12" cy="12" r="8" fill="white" />
        {status === 'idle' && <circle cx="8" cy="8" r="5.5" fill="black" />}
        {status === 'dnd' && (
          <rect x="6.5" y="10.25" width="11" height="3.5" rx="1.75" fill="black" />
        )}
        {status === 'offline' && <circle cx="12" cy="12" r="4" fill="black" />}
      </mask>
      <circle cx="12" cy="12" r="8" fill={STATUS_COLOR[status]} mask={`url(#${maskId})`} />
    </svg>
  );
}

function CustomStatusBubble({ customStatus }) {
  const { emoji, text: statusText } = customStatus;
  return (
    // Düşünce baloncuğu avatarın sağ üstünden çıkar; kuyruk noktaları avatara doğru.
    <div className="relative -mt-8 ml-1 min-w-0 flex-1 self-start">
      <span
        aria-hidden="true"
        className="bg-popover absolute bottom-0.5 -left-2.5 size-3 rounded-full border"
      />
      <span
        aria-hidden="true"
        className="bg-popover absolute -bottom-1.5 -left-5 size-1.5 rounded-full border"
      />
      <p className="bg-popover relative inline-flex max-w-full items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm leading-snug shadow-sm">
        <span className="sr-only">Özel durum: </span>
        {emoji?.url ? (
          <img src={emoji.url} alt={`:${emoji.name}:`} className="size-5 shrink-0" />
        ) : (
          emoji?.name && <span className="shrink-0">{emoji.name}</span>
        )}
        {statusText && <DiscordText text={statusText} className="line-clamp-3 min-w-0" />}
      </p>
    </div>
  );
}

export function DiscordView({ data }) {
  const maskId = `discord-status-${useId().replace(/:/g, '')}`;
  const status = data.status ?? 'offline';
  const name = data.globalName || data.username;
  // Eski snapshot'larda özel durum etkinlik olarak gelebilir: listeden çıkarılıp baloncuğa taşınır.
  const isCustom = (a) => a.type === 'CUSTOM' || a.name === 'Custom Status';
  const legacyCustom = (data.activities ?? []).find(isCustom);
  const activities = (data.activities ?? []).filter((a) => !isCustom(a));
  const now = useNow(activities.some((a) => a.startedAt));
  const badges = data.badges ?? [];
  const shown = badges.slice(0, MAX_BADGES);
  const hidden = badges.slice(MAX_BADGES);
  const custom =
    data.customStatus ??
    (legacyCustom && { text: legacyCustom.state, emoji: legacyCustom.emoji ?? null });
  const hasCustom = Boolean(custom && (custom.text || custom.emoji));

  return (
    <div className="flex flex-col">
      <div
        className="relative aspect-[17/6] w-full bg-cover bg-center"
        style={{
          backgroundColor: data.accentColor ?? 'var(--surface-3)',
          backgroundImage: data.bannerUrl ? `url("${data.bannerUrl}")` : undefined,
        }}
      >
        {data.nameplate?.url && (
          <img
            src={data.nameplate.url}
            alt=""
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-1/2 w-full object-cover opacity-70"
          />
        )}
      </div>

      <div className="relative px-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="relative -mt-[52px] size-[92px] shrink-0">
            <span className="bg-card absolute inset-0 rounded-full" />
            {data.avatarUrl && (
              <img
                src={data.avatarUrl}
                alt=""
                width={84}
                height={84}
                className="absolute inset-1 size-[84px] rounded-full object-cover"
              />
            )}
            {data.avatarDecorationUrl && (
              <img
                src={data.avatarDecorationUrl}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -inset-[6%] size-[112%] max-w-none"
              />
            )}
            <StatusIcon status={status} maskId={maskId} />
            <span className="sr-only">{`Durum: ${PRESENCE_LABELS[status]}`}</span>
          </div>
          {hasCustom && <CustomStatusBubble customStatus={custom} />}
        </div>

        <div className="mt-2 grid gap-1">
          <p className="text-xl leading-tight font-bold break-words">{name}</p>
          <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
            <span>{data.username}</span>
            {data.pronouns && (
              <>
                <span aria-hidden="true" className="text-muted-foreground">
                  •
                </span>
                <span className="text-muted-foreground">{data.pronouns}</span>
              </>
            )}
            {data.serverTag && (
              <span className="bg-muted inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-xs font-semibold">
                {data.serverTag.badgeUrl && (
                  <img src={data.serverTag.badgeUrl} alt="" className="size-3.5" />
                )}
                {data.serverTag.tag}
              </span>
            )}
          </p>
        </div>

        {badges.length > 0 && (
          <ul aria-label="Rozetler" className="mt-2.5 flex flex-wrap items-center gap-1">
            {shown.map((b) => (
              <Badge key={b.id} badge={b} />
            ))}
            {hidden.length > 0 && (
              <li
                title={hidden.map((b) => b.label).join(', ')}
                className="bg-muted grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11px] font-semibold"
              >
                +{hidden.length}
              </li>
            )}
          </ul>
        )}

        {(activities.length > 0 || data.voice) && (
          <ul className="mt-4 grid gap-2">
            {data.voice && (
              <li className={cn(box, 'gap-1 text-sm')}>
                <p className={label}>
                  <Volume2 aria-hidden="true" className="size-3.5" />
                  Ses kanalında
                </p>
                <p className="flex items-center gap-1.5 font-semibold">
                  {data.voice.muted ? (
                    <MicOff aria-label="Mikrofon kapalı" className="text-status-dnd size-4" />
                  ) : (
                    <Mic aria-hidden="true" className="size-4" />
                  )}
                  <span className="truncate">{data.voice.channelName}</span>
                </p>
                {data.voice.guildName && (
                  <p className="text-muted-foreground truncate text-xs">{data.voice.guildName}</p>
                )}
              </li>
            )}
            {activities.map((a, i) => (
              <Activity key={`${a.type}-${a.name}-${i}`} activity={a} now={now} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
