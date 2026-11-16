// CLI yardımcıları: argüman ayrıştırma, gizli girdi, hata biçimi.
import readline from 'node:readline';
import { ZodError } from 'zod';
import { AppError } from '../../src/lib/httpError.js';
import { prisma } from '../../src/lib/prisma.js';
import { CliError } from '../../src/modules/admins/cliActions.js';

/** @param {string} question */
export function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    }),
  );
}

/** Terminalde yazılanı göstermeden okur. @param {string} question */
export function askHidden(question) {
  if (!process.stdin.isTTY) return ask(question);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  let muted = false;
  // readline'ın iç yazma kancası: yazılan karakterleri terminale yansıtmaz.
  rl._writeToOutput = (text) => {
    if (!muted) process.stdout.write(text);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

/** Ortak çalıştırıcı: hataları okunur biçimde yazar, çıkış kodunu ayarlar, bağlantıyı kapatır. */
export async function runCli(main) {
  try {
    await main();
  } catch (err) {
    if (err instanceof CliError) console.error(`Hata: ${err.message}`);
    else if (err instanceof ZodError) {
      console.error(`Hata: ${err.issues.map((i) => i.message).join(' ')}`);
    } else if (err instanceof AppError) {
      const details = Array.isArray(err.details) ? err.details.map((d) => d.message).join(' ') : '';
      console.error(`Hata: ${details || err.message}`);
    } else console.error('Beklenmeyen hata:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}
