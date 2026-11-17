// ADMIN.md §2.3 — YALNIZCA GELİŞTİRME: yönetici oluştur / şifresini ayarla (uzunluk ≥ 8).
// Kullanım:
//   npm run admin:dev-set -w backend -- --default                 (varsayılan dev yöneticisi)
//   npm run admin:dev-set -w backend -- --email you@example.com   (şifre gizli sorulur / stdin)
// production'da devSetAdmin çalışmayı reddeder; varsayılan şifre yalnızca yerel geliştirme içindir.
import { parseArgs } from 'node:util';
import { devSetAdmin } from '../src/modules/admins/cliActions.js';
import { ask, askHidden, runCli } from './lib/cli.js';

const DEFAULT_DEV_ADMIN = Object.freeze({
  email: '1uc44s@github.com',
  password: 'CreatedWithAiByLucas',
});

const { values } = parseArgs({
  options: { email: { type: 'string' }, default: { type: 'boolean' } },
});

await runCli(async () => {
  const email = values.default
    ? (values.email ?? DEFAULT_DEV_ADMIN.email)
    : (values.email ?? (await ask('E-posta: ')));
  const password = values.default ? DEFAULT_DEV_ADMIN.password : await askHidden('Şifre: ');
  const { created } = await devSetAdmin({ email, password });
  console.warn(
    `${created ? 'Yönetici oluşturuldu' : 'Şifre güncellendi; oturumlar kapatıldı'}: ${email}`,
  );
});
