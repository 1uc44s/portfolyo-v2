// Yalnızca `npm run dev`: .env'i `--import` ile yükler. Neden `--env-file` değil: Node'un watch modu
// `--env-file` verilince .env'in dizinini (backend/) izler; Windows'ta bu özyinelemelidir ve
// uploads/ altına her yazım (yükleme, tmp) sunucuyu yeniden başlatıp isteği 502 ile keserdi.
// Sonuç: .env değişince dev sunucusunu elle yeniden başlat.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
