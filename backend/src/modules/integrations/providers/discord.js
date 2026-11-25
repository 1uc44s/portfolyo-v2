// Discord: bot Gateway'e bağlanır (Guilds, GuildMembers, GuildPresences, GuildVoiceStates).
// Hedef kullanıcı botla ortak bir sunucuda olmalı. Presence/ses değişiminde 2 sn debounce, 5 dk'da bir
// tam yenileme. Bot API'sinin verdiği her public alan alınır (banner, vurgu rengi, rozetler, dekorasyon,
// sunucu etiketi, isim plakası, tüm etkinlikler + ses kanalı). Hitap şekli, profil efekti ve isim stili
// bot API'sinde YOK → uydurulmaz; hitap şekli admin config'inden gelir. Biyografi yok (2026-11-16).
import { ActivityType, Client, GatewayIntentBits, Partials } from 'discord.js';
import { logger } from '../../../lib/logger.js';
import { httpsUrl, IntegrationError } from '../http.js';

const DEBOUNCE_MS = 2000;
const FULL_REFRESH_MS = 5 * 60_000;
const LOGIN_TIMEOUT_MS = 15_000;

const ACTIVITY_TYPES = {
  [ActivityType.Playing]: 'PLAYING',
  [ActivityType.Streaming]: 'STREAMING',
  [ActivityType.Listening]: 'LISTENING',
  [ActivityType.Watching]: 'WATCHING',
  [ActivityType.Custom]: 'CUSTOM',
  [ActivityType.Competing]: 'COMPETING',
};

const BADGES = {
  Staff: 'Discord Çalışanı',
  Partner: 'Partner Sunucu Sahibi',
  Hypesquad: 'HypeSquad Etkinlikleri',
  BugHunterLevel1: 'Hata Avcısı',
  BugHunterLevel2: 'Altın Hata Avcısı',
  HypeSquadOnlineHouse1: 'HypeSquad Bravery',
  HypeSquadOnlineHouse2: 'HypeSquad Brilliance',
  HypeSquadOnlineHouse3: 'HypeSquad Balance',
  PremiumEarlySupporter: 'Erken Destekçi',
  VerifiedDeveloper: 'Erken Doğrulanmış Bot Geliştiricisi',
  CertifiedModerator: 'Moderatör Programları Mezunu',
  ActiveDeveloper: 'Aktif Geliştirici',
};

const text = (v, max = 128) => (v ? String(v).slice(0, max) : null);

/**
 * discord.js CDN yardımcıları geçersiz boyutta (2'nin kuvveti olmayan) RangeError fırlatır; tek bir
 * alan tüm snapshot'ı düşürmesin diye her URL ayrı korunur (2026-11-16: banner 600 hatası).
 * İzinli boyutlar: 16, 32, 64, 128, 256, 512, 1024, 2048, 4096.
 */
export function safeUrl(build) {
  try {
    return httpsUrl(build());
  } catch {
    return null;
  }
}
const ms = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null);

function toActivity(a) {
  // Özel durum bazı istemcilerde tür yerine yalnızca id/ad ile gelir: etkinlik değil, baloncuk.
  const isCustom =
    a.type === ActivityType.Custom || a.id === 'custom' || a.name === 'Custom Status';
  const type = isCustom ? 'CUSTOM' : (ACTIVITY_TYPES[a.type] ?? 'PLAYING');
  const emoji = a.emoji
    ? {
        name: text(a.emoji.name, 64),
        url: a.emoji.id
          ? `https://cdn.discordapp.com/emojis/${a.emoji.id}.${a.emoji.animated ? 'gif' : 'webp'}?size=48`
          : null,
      }
    : null;
  return {
    type,
    name: text(a.name, 64) ?? '',
    details: text(a.details),
    state: text(a.state),
    url: type === 'STREAMING' ? httpsUrl(a.url) : null,
    startedAt: ms(a.timestamps?.start),
    endsAt: ms(a.timestamps?.end),
    largeImageUrl: safeUrl(() => a.assets?.largeImageURL?.({ size: 256 })),
    largeText: text(a.assets?.largeText),
    smallImageUrl: safeUrl(() => a.assets?.smallImageURL?.({ size: 64 })),
    emoji: type === 'CUSTOM' ? emoji : null,
  };
}

/** Yalnızca public alanlar. `voice`: GuildMember.voice (varsa). */
export function toDiscordSnapshot(user, presence, voice = null) {
  const all = (presence?.activities ?? []).map(toActivity);
  const custom = all.find((a) => a.type === 'CUSTOM') ?? null;
  const activities = all.filter((a) => a.type !== 'CUSTOM').slice(0, 6);
  const flags = user.flags?.toArray?.() ?? [];
  const nameplate = user.collectibles?.nameplate ?? null;
  const guild = user.primaryGuild?.identityEnabled ? user.primaryGuild : null;
  const channel = voice?.channel ?? null;
  return {
    avatarUrl: safeUrl(() => user.displayAvatarURL?.({ size: 256 })),
    avatarDecorationUrl: safeUrl(() => user.avatarDecorationURL?.()),
    bannerUrl: safeUrl(() => user.bannerURL?.({ size: 1024 })),
    accentColor: user.hexAccentColor ?? null,
    username: String(user.username ?? ''),
    globalName: user.globalName ? String(user.globalName) : null,
    status: ['online', 'idle', 'dnd'].includes(presence?.status) ? presence.status : 'offline',
    customStatus: custom ? { text: custom.state, emoji: custom.emoji } : null,
    activities,
    voice: channel
      ? {
          channelName: text(channel.name, 100),
          guildName: text(channel.guild?.name, 100),
          muted: Boolean(voice.selfMute || voice.serverMute),
          deafened: Boolean(voice.selfDeaf || voice.serverDeaf),
          streaming: Boolean(voice.streaming),
        }
      : null,
    badges: flags.filter((f) => BADGES[f]).map((f) => ({ id: f, label: BADGES[f] })),
    serverTag: guild?.tag
      ? { tag: text(guild.tag, 8), badgeUrl: safeUrl(() => user.guildTagBadgeURL?.({ size: 32 })) }
      : null,
    nameplate: nameplate?.asset
      ? {
          url: httpsUrl(
            `https://cdn.discordapp.com/assets/collectibles/${nameplate.asset}static.png`,
          ),
          label: text(nameplate.label, 64),
        }
      : null,
    // Bot API'sinde yok; admin config'inden public okumada eklenir (uydurulmaz).
    pronouns: null,
  };
}

/** discord.js hatası → admin'e gösterilecek güvenli mesaj (token içermez). */
export function discordError(err) {
  if (err instanceof IntegrationError) return err;
  const code = err?.code;
  if (code === 'TokenInvalid' || code === 'TokenMissing') {
    return new IntegrationError('Bot token geçersiz.', { code: 'AUTH_FAILED' });
  }
  if (code === 'DisallowedIntents' || String(err?.message).includes('disallowed intents')) {
    return new IntegrationError(
      "Ayrıcalıklı intent'ler kapalı: Developer Portal > Bot'ta Server Members ve Presence Intent'i aç.",
      { code: 'DISALLOWED_INTENTS' },
    );
  }
  // Kod içi hata (ör. geçersiz CDN boyutu): bağlantı sorunu gibi gösterilmez, ayrıntı loglanır.
  if (err instanceof TypeError || err instanceof RangeError) {
    logger.error({ err: err.message }, 'Discord snapshot işlenemedi');
    return new IntegrationError('Discord verisi işlenemedi; ayrıntı sunucu logunda.', {
      code: 'PARSE_FAILED',
    });
  }
  return new IntegrationError("Discord'a bağlanılamadı.", { code: 'NETWORK' });
}

let clientFactory = () =>
  new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.GuildMember, Partials.User],
  });

/** Testler için (null → gerçek discord.js istemcisi). */
export function setDiscordClientFactory(fn) {
  clientFactory =
    fn ??
    (() =>
      new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.GuildPresences,
          GatewayIntentBits.GuildVoiceStates,
        ],
        partials: [Partials.GuildMember, Partials.User],
      }));
}

async function login(client, token) {
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new IntegrationError('Discord 15 sn içinde hazır olmadı.', { code: 'TIMEOUT' })),
      LOGIN_TIMEOUT_MS,
    );
    timer.unref?.();
    client.once('clientReady', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  try {
    await client.login(token);
    await ready;
  } catch (err) {
    throw discordError(err);
  }
}

/** Ortak sunucularda üyeyi arar (presence ile). */
async function findMember(client, userId) {
  for (const guild of client.guilds.cache.values()) {
    try {
      const member = await guild.members.fetch({ user: userId, withPresences: true, force: true });
      if (member) return member;
    } catch {
      // Bu sunucuda yok — sonrakine bak.
    }
  }
  throw new IntegrationError('Kullanıcı botla ortak sunucuda değil.', { code: 'NOT_IN_GUILD' });
}

/** Banner ve vurgu rengi yalnızca zorla çekilen kullanıcı nesnesinde gelir. */
async function snapshotOf(member) {
  let user = member.user;
  try {
    user = (await member.user.fetch?.(true)) ?? member.user;
  } catch {
    // Banner alınamazsa diğer alanlarla devam.
  }
  return toDiscordSnapshot(user, member.presence, member.voice ?? null);
}

function assertConfigured({ config, secrets }) {
  if (!secrets?.botToken || !config?.userId) {
    throw new IntegrationError('Bot token ve kullanıcı ID girilmeli.', { code: 'NOT_CONFIGURED' });
  }
}

export const discord = {
  slug: 'discord',
  provider: 'DISCORD',
  staleAfterMs: 10 * 60_000,
  intervalMs: FULL_REFRESH_MS,
  longLived: true,

  /** Tek seferlik: bağlan, üyeyi oku, kapat (test ve "Şimdi senkronize et"). */
  async sync(ctx) {
    assertConfigured(ctx);
    const client = clientFactory();
    try {
      await login(client, ctx.secrets.botToken);
      return await snapshotOf(await findMember(client, ctx.config.userId));
    } catch (err) {
      throw discordError(err);
    } finally {
      await client.destroy?.();
    }
  },

  test: (ctx) => discord.sync(ctx),

  /**
   * Kalıcı Gateway bağlantısı. Presence değişiminde snapshot 2 sn debounce ile yazılır.
   * @param {{ config: any, secrets: any, onSnapshot: (s: object) => Promise<void>,
   *   onError: (e: Error) => Promise<void> }} ctx
   * @returns {Promise<() => Promise<void>>} durdurucu
   */
  async start(ctx) {
    assertConfigured(ctx);
    const { userId } = ctx.config;
    const client = clientFactory();
    let timer = null;
    let interval = null;
    let stopped = false;

    const refresh = async () => {
      if (stopped) return;
      try {
        await ctx.onSnapshot(await snapshotOf(await findMember(client, userId)));
      } catch (err) {
        await ctx.onError(discordError(err));
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, DEBOUNCE_MS);
      timer.unref?.();
    };

    client.on('presenceUpdate', (_old, presence) => {
      if (presence?.userId === userId) schedule();
    });
    client.on('userUpdate', (_old, user) => {
      if (user?.id === userId) schedule();
    });
    client.on('voiceStateUpdate', (_old, state) => {
      if (state?.id === userId) schedule();
    });
    client.on('error', (err) => void ctx.onError(discordError(err)));

    try {
      await login(client, ctx.secrets.botToken);
    } catch (err) {
      await client.destroy?.();
      throw err;
    }
    await refresh();
    interval = setInterval(refresh, FULL_REFRESH_MS);
    interval.unref?.();

    return async () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(interval);
      await client.destroy?.();
    };
  },
};
