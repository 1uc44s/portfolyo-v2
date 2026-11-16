// ADMIN.md §2.3 — geçici giriş kilidini kaldırır. Kullanım:
//   npm run admin:unlock -w backend -- --email admin@example.com
import { parseArgs } from 'node:util';
import { unlockAdmin } from '../src/modules/admins/cliActions.js';
import { ask, runCli } from './lib/cli.js';

const { values } = parseArgs({ options: { email: { type: 'string' } } });

await runCli(async () => {
  const email = values.email ?? (await ask('E-posta: '));
  await unlockAdmin(email);
  console.warn('Hesap kilidi kaldırıldı.');
});
