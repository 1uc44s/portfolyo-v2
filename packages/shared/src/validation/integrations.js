// F15 — ROUTES.md §4.7, SRS FR-INT — entegrasyon yapılandırma ve secret şemaları.
// Config gizli değildir (admin API'de döner); secret'lar yalnızca yazılır, `isSet` olarak okunur.
import { z } from 'zod';

export const INTEGRATION_SLUGS = Object.freeze(['discord', 'spotify', 'github']);
export const SLUG_TO_PROVIDER = Object.freeze({
  discord: 'DISCORD',
  spotify: 'SPOTIFY',
  github: 'GITHUB',
});

const trimmed = (message) => z.string({ error: message }).trim().min(1, message);

export const DISCORD_MANUAL_LIMITS = Object.freeze({ pronouns: 40 });

export const discordConfigSchema = z
  .object({
    userId: trimmed('Kullanıcı ID zorunlu.').regex(
      /^\d{17,20}$/,
      'Discord kullanıcı ID 17–20 haneli bir sayı olmalı (Geliştirici modu > ID kopyala).',
    ),
    // Bot API'si hitap şeklini vermez; profil kartında gösterilmek üzere elle girilir.
    pronouns: z
      .string()
      .trim()
      .max(
        DISCORD_MANUAL_LIMITS.pronouns,
        `Hitap şekli en fazla ${DISCORD_MANUAL_LIMITS.pronouns} karakter.`,
      )
      .optional(),
  })
  .strict();

export const spotifyConfigSchema = z
  .object({
    clientId: trimmed('Client ID zorunlu.').regex(
      /^[a-f0-9]{32}$/i,
      'Client ID 32 karakterlik onaltılık bir değer olmalı.',
    ),
  })
  .strict();

export const githubConfigSchema = z
  .object({
    username: trimmed('Kullanıcı adı zorunlu.').regex(
      /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i,
      'Geçerli bir GitHub kullanıcı adı gir.',
    ),
  })
  .strict();

export const INTEGRATION_CONFIG_SCHEMAS = Object.freeze({
  discord: discordConfigSchema,
  spotify: spotifyConfigSchema,
  github: githubConfigSchema,
});

/** Yalnızca SUPER_ADMIN yazar (L5). Değerler hiçbir yanıtta dönmez. */
export const INTEGRATION_SECRET_SCHEMAS = Object.freeze({
  discord: z
    .object({
      botToken: trimmed('Bot token zorunlu.')
        .min(50, 'Bot token geçersiz görünüyor.')
        .max(120, 'Bot token geçersiz görünüyor.')
        .regex(/^[\w.-]+$/, 'Bot token geçersiz görünüyor.'),
    })
    .strict(),
  spotify: z
    .object({
      clientSecret: trimmed('Client Secret zorunlu.').regex(
        /^[a-f0-9]{32}$/i,
        'Client Secret 32 karakterlik onaltılık bir değer olmalı.',
      ),
    })
    .strict(),
  github: null,
});

/** Admin yanıtında `isSet` gösterilen secret anahtarları. */
export const INTEGRATION_SECRET_KEYS = Object.freeze({
  discord: ['botToken'],
  spotify: ['clientSecret', 'refreshToken'],
  github: [],
});

export const integrationPatchSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    config: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Değiştirilecek bir alan gönderilmedi.' });

export const GITHUB_CARDS = Object.freeze(['stats', 'streak']);
export const CARD_THEMES = Object.freeze(['dark', 'light']);
