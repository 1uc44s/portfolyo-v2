// F21 — YALNIZCA GELİŞTİRME: referans "7 Tech Stack" görselinden (976×1092 düzeni) 7 daire çizimini
// keser ve ilk Tech Stack bölümünün öğelerine sırayla (sortOrder) atar.
// Normal yol admin panelinden yüklemektir; bu betik ilk kurulumu hızlandırır.
// Kullanım: npm run tech-stack:import -w backend -- --source <görsel> [--dry-run]
import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import sharp from 'sharp';
import { prisma } from '../src/lib/prisma.js';
import { replaceItemImage } from '../src/modules/techstack/service.js';
import { runCli } from './lib/cli.js';

// Referans görseldeki daire merkezleri ve iç yarıçap (kenar çizgisi hariç), 976×1092 ölçeğinde.
const REF = { width: 976, height: 1092 };
const CIRCLES = [
  [489, 188],
  [757, 318],
  [812, 622],
  [640, 868],
  [337, 867],
  [165, 622],
  [220, 318],
];
const INNER_RADIUS = 95;

const { values } = parseArgs({
  options: { source: { type: 'string' }, 'dry-run': { type: 'boolean' } },
});

async function circleCrop(input, scale, [cx, cy], out) {
  const r = Math.round(INNER_RADIUS * scale);
  const size = r * 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`,
  );
  await sharp(input)
    .extract({
      left: Math.round(cx * scale) - r,
      top: Math.round(cy * scale) - r,
      width: size,
      height: size,
    })
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(out);
}

const asUpload = async (filePath, name) => ({
  path: filePath,
  originalname: name,
  mimetype: 'image/png',
  size: (await stat(filePath)).size,
});

await runCli(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Yalnızca geliştirme ortamında.');
  if (!values.source) throw new Error('--source <görsel> zorunlu.');
  const meta = await sharp(values.source).metadata();
  const scale = meta.width / REF.width;
  if (Math.abs(meta.height / scale - REF.height) > 4) {
    throw new Error(`Görsel oranı referansla uyuşmuyor (${meta.width}×${meta.height}).`);
  }
  const dir = await mkdtemp(path.join(os.tmpdir(), 'techstack-'));
  try {
    const group = await prisma.techStackGroup.findFirst({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    const items = group
      ? await prisma.techStackItem.findMany({
          where: { groupId: group.id },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        })
      : [];
    const admin = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const ctx = { adminId: admin?.id ?? null, ctx: { ipAddress: null, userAgent: 'cli' } };
    for (let i = 0; i < CIRCLES.length; i += 1) {
      const out = path.join(dir, `tech-${i + 1}.png`);
      await circleCrop(values.source, scale, CIRCLES[i], out);
      const item = items[i];
      console.warn(`${i + 1}. ${item ? item.label : '(öğe yok)'} <- ${out}`);
      if (item && !values['dry-run']) {
        await replaceItemImage(item.id, await asUpload(out, `tech-${i + 1}.png`), ctx);
      }
    }
    console.warn(values['dry-run'] ? 'Deneme: hiçbir şey kaydedilmedi.' : 'Tamamlandı.');
  } finally {
    if (!values['dry-run']) await rm(dir, { recursive: true, force: true });
  }
});
