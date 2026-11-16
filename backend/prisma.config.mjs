// Prisma 7 yapılandırması (JS — RULES.md §1). Prisma 7 .env dosyasını kendisi yüklemez;
// yerelde backend/.env Node'un yerleşik yükleyicisiyle okunur, CI/prod'da ortam değişkeni kullanılır.
// DATABASE_URL yoksa (ör. temiz kurulumda postinstall `prisma generate`) datasource eklenmez;
// generate bağlantı gerektirmez, migrate komutları ise açık bir hata verir.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'prisma/config';

const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (!process.env.DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);

const url = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node --env-file-if-exists=.env prisma/seed.mjs',
  },
  ...(url && { datasource: { url } }),
});
