// 2026-11-16 — Varsayılan linkler (kullanıcı isteği). Seed bir kez ekler (SystemState "links_seeded");
// admin sonradan silse de yeniden oluşmaz. Görseller basit üretilmiş PNG'lerdir; adminden değiştirilebilir.
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma.js';
import { ensureStorageDirs } from '../../storage/index.js';
import { createLink } from './service.js';

export const DEFAULT_LINKS = Object.freeze([
  { title: 'GitHub', url: 'https://github.com/1uc44s', bg: '#181717', fg: '#ffffff', mark: 'GH' },
  {
    title: 'Instagram',
    url: 'https://www.instagram.com/codecraftdevelopment/',
    bg: 'url(#ig)',
    fg: '#ffffff',
    mark: 'IG',
  },
  {
    title: 'Web Site',
    url: 'https://vasquezlukii.dev/',
    bg: '#4f46e5',
    fg: '#ffffff',
    mark: 'WEB',
  },
]);

export const LINKS_SEED_FLAG = 'links_seeded';

const iconSvg = ({ bg, fg, mark }) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs><linearGradient id="ig" x1="0" y1="1" x2="1" y2="0">
    <stop offset="0" stop-color="#feda75"/><stop offset="0.35" stop-color="#fa7e1e"/>
    <stop offset="0.65" stop-color="#d62976"/><stop offset="1" stop-color="#4f5bd5"/>
  </linearGradient></defs>
  <rect width="512" height="512" rx="112" fill="${bg}"/>
  <text x="256" y="256" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif"
    font-weight="700" font-size="${mark.length > 2 ? 150 : 200}" fill="${fg}">${mark}</text>
</svg>`);

/** Varsayılan linkleri oluşturur (sıra korunur). */
export async function createDefaultLinks({ adminId = null } = {}) {
  await ensureStorageDirs();
  const dir = await mkdtemp(path.join(os.tmpdir(), 'links-'));
  const ctx = { adminId, ctx: { ipAddress: null, userAgent: 'seed' } };
  try {
    for (const [i, link] of DEFAULT_LINKS.entries()) {
      const file = path.join(dir, `link-${i + 1}.png`);
      await sharp(iconSvg(link)).png().toFile(file);
      await createLink(
        { title: link.title, url: link.url, isActive: true },
        {
          path: file,
          originalname: `${link.title}.png`,
          mimetype: 'image/png',
          size: (await stat(file)).size,
        },
        ctx,
      );
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return DEFAULT_LINKS.length;
}

/** Seed: link tablosu boşsa ve daha önce eklenmediyse bir kez ekler. */
export async function seedDefaultLinksOnce() {
  const flag = await prisma.systemState.findUnique({ where: { key: LINKS_SEED_FLAG } });
  if (flag) return 0;
  const created = (await prisma.linkItem.count()) === 0 ? await createDefaultLinks() : 0;
  await prisma.systemState.create({
    data: { key: LINKS_SEED_FLAG, value: { at: new Date().toISOString() } },
  });
  return created;
}
