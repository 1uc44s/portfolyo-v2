// kayıp 2FA cihazı. Kullanım:
//   npm run admin:reset-2fa -w backend -- --email admin@example.com
import { parseArgs } from 'node:util';
import { resetAdminTwoFactor } from '../src/modules/admins/cliActions.js';
import { ask, runCli } from './lib/cli.js';

const { values } = parseArgs({ options: { email: { type: 'string' } } });

await runCli(async () => {
  const email = values.email ?? (await ask('E-posta: '));
  await resetAdminTwoFactor(email);
  console.warn(
    'İki aşamalı doğrulama kapatıldı ve tüm oturumlar sonlandırıldı. Girişten sonra yeniden kur.',
  );
});
