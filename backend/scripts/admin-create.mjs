// ilk SÜPER ADMİN. Kullanım:
//   npm run admin:create -w backend                     (etkileşimli)
//   INITIAL_ADMIN_EMAIL=… INITIAL_ADMIN_PASSWORD=… npm run admin:create -w backend
//   npm run admin:create -w backend -- --force          (ek süper admin)
import { parseArgs } from 'node:util';
import { createSuperAdmin } from '../src/modules/admins/cliActions.js';
import { ask, askHidden, runCli } from './lib/cli.js';

const { values } = parseArgs({
  options: {
    email: { type: 'string' },
    name: { type: 'string' },
    force: { type: 'boolean', default: false },
  },
});

await runCli(async () => {
  const email = values.email ?? process.env.INITIAL_ADMIN_EMAIL ?? (await ask('E-posta: '));
  let password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!password) {
    password = await askHidden('Geçici şifre (en az 12 karakter): ');
    const confirm = await askHidden('Şifre (tekrar): ');
    if (password !== confirm) throw new Error('Şifreler eşleşmiyor.');
  }
  const admin = await createSuperAdmin({
    email,
    password,
    displayName: values.name ?? null,
    force: values.force,
  });
  console.warn(`Süper admin oluşturuldu: ${admin.email}`);
  console.warn(
    'İlk girişte şifre değiştirmek zorunludur. Şimdi .env içindeki INITIAL_ADMIN_* değerlerini sil.',
  );
});
