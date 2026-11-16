// ADMIN.md §2.3 — YALNIZCA GELİŞTİRME: yönetici oluştur / şifresini ayarla (uzunluk ≥ 8).
// Kullanım: npm run admin:dev-set -w backend -- --email you@example.com   (şifre gizli sorulur / stdin)
import { parseArgs } from 'node:util';
import { devSetAdmin } from '../src/modules/admins/cliActions.js';
import { ask, askHidden, runCli } from './lib/cli.js';

const { values } = parseArgs({ options: { email: { type: 'string' } } });

await runCli(async () => {
  const email = values.email ?? (await ask('E-posta: '));
  const password = await askHidden('Şifre: ');
  const { created } = await devSetAdmin({ email, password });
  console.warn(created ? 'Yönetici oluşturuldu.' : 'Şifre güncellendi; oturumlar kapatıldı.');
});
