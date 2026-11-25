// depoda TypeScript dosyası bulunamaz.
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'uploads', 'generated']);
const FORBIDDEN_EXT = new Set(['.ts', '.tsx', '.mts', '.cts']);
const FORBIDDEN_NAMES = new Set(['tsconfig.json']);

async function walk(dir, found) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) await walk(path.join(dir, entry.name), found);
      continue;
    }
    if (FORBIDDEN_EXT.has(path.extname(entry.name)) || FORBIDDEN_NAMES.has(entry.name)) {
      found.push(path.relative(ROOT, path.join(dir, entry.name)));
    }
  }
  return found;
}

const found = await walk(ROOT, []);
if (found.length > 0) {
  console.error('TypeScript dosyası bulundu (yasak):\n' + found.map((f) => `  - ${f}`).join('\n'));
  process.exit(1);
}
console.warn('OK: TypeScript dosyası yok.');
