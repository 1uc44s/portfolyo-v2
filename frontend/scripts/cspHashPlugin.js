// SRS §9.1, FR-THM-02 — index.html'deki inline script'lerin SHA-256 hash'lerini üretir.
// Çıktı: dist/csp-hashes.json → reverse proxy CSP'sindeki script-src için kullanılır.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const INLINE_SCRIPT = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;

export function cspHashPlugin() {
  let outDir = 'dist';
  return {
    name: 'vasquez:csp-hashes',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      const html = await readFile(path.join(outDir, 'index.html'), 'utf8');
      const hashes = [...html.matchAll(INLINE_SCRIPT)].map(
        ([, body]) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`,
      );
      const scriptSrc = ["'self'", ...hashes, 'https://challenges.cloudflare.com'].join(' ');
      await writeFile(
        path.join(outDir, 'csp-hashes.json'),
        `${JSON.stringify({ inlineScriptHashes: hashes, scriptSrc }, null, 2)}\n`,
      );
      console.warn(`[csp] ${hashes.length} inline script hash'i → csp-hashes.json`);
    },
  };
}
