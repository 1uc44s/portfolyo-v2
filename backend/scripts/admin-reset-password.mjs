// SMTP yokken şifre kurtarma. Kullanım:
//   npm run admin:reset-password -w backend -- --email admin@example.com
import { parseArgs } from 'node:util';
import { resetAdminPassword } from '../src/modules/admins/cliActions.js';
import { ask, runCli } from './lib/cli.js';

const { values } = parseArgs({ options: { email: { type: 'string' } } });

await runCli(async () => {
  const email = values.email ?? (await ask('E-posta: '));
  const { temporaryPassword } = await resetAdminPassword(email);
  console.warn('Geçici şifre (yalnızca bir kez gösterilir, ilk girişte değiştirilmeli):');
  console.warn(`  ${temporaryPassword}`);
  console.warn('Tüm oturumlar sonlandırıldı.');
});
