// YALNIZCA GELİŞTİRME (2026-11-16, kullanıcı isteği) — siteyi tamamen varsayılan/boş hale getirir:
// tüm medya (arka plan, profil, müzik, cursor, isim efekti, Tech Stack, yağan öğe) + ziyaretçi/indirme
// kayıtları + entegrasyon secret'ları/snapshot'ları silinir; hero, başlıklar, Tech Stack ve Hakkımda
// varsayılana döner; varsayılan 3 link yeniden eklenir. Admin e-postası ayarlanır (şifre ayrı: koda yazılmaz).
// Kullanım: npm run dev:reset-defaults -w backend -- --yes [--email 1uc44s@github.com]
import { parseArgs } from 'node:util';
import { prisma } from '../src/lib/prisma.js';
import { createDefaultLinks, LINKS_SEED_FLAG } from '../src/modules/links/defaults.js';
import { deleteAssetsInTx, hooks } from '../src/modules/media/service.js';
import { invalidateSiteCache } from '../src/modules/public/site.js';
import { runCli } from './lib/cli.js';

const { values } = parseArgs({
  options: { yes: { type: 'boolean' }, email: { type: 'string' } },
});

const DEFAULT_EMAIL = '1uc44s@github.com';

const DEFAULT_TECH_STACK_GROUPS = [
  { titleTop: 'My', titleMain: 'Tech', titleBottom: 'Stack', published: false, sortOrder: 0 },
  { titleTop: 'My', titleMain: 'Security', titleBottom: 'Skill', published: false, sortOrder: 10 },
];

await runCli(async () => {
  if (process.env.NODE_ENV === 'production') throw new Error('Yalnızca geliştirme ortamında.');
  if (!values.yes) throw new Error('Geri alınamaz. Onay için --yes ver.');

  // Silinecek medyaya bağlı tüm asset'leri topla (silme kuyruğuna yazılır, API işçisi diskten siler).
  const [backgrounds, pfps, musics, cursors, tech, overlays, falling, links, site] =
    await Promise.all([
      prisma.background.findMany({ include: { asset: true } }),
      prisma.profileMedia.findMany({ include: { asset: true } }),
      prisma.music.findMany({ include: { audio: true, cover: true } }),
      prisma.cursorSet.findMany({ include: { normal: true, click: true } }),
      prisma.techStackItem.findMany({ include: { image: true } }),
      prisma.nameOverlay.findMany({ include: { asset: true } }),
      prisma.fallingItem.findMany({ include: { image: true } }),
      prisma.linkItem.findMany({ include: { image: true } }),
      prisma.siteSettings.findUnique({ where: { id: 1 }, include: { favicon: true } }),
    ]);

  const assets = [
    ...backgrounds.map((b) => b.asset),
    ...pfps.map((p) => p.asset),
    ...musics.flatMap((m) => [m.audio, m.cover]),
    ...cursors.flatMap((c) => [c.normal, c.click]),
    ...tech.map((t) => t.image),
    ...overlays.map((o) => o.asset),
    ...falling.map((f) => f.image),
    ...links.map((l) => l.image),
    site?.favicon,
  ].filter(Boolean);

  const counts = await prisma.$transaction(async (tx) => {
    // Ziyaretçi/indirme ve rotasyon izleri
    await tx.analyticsEvent.deleteMany({});
    await tx.downloadEvent.deleteMany({});
    await tx.dailyContentSelection.deleteMany({});
    await tx.contentOverride.deleteMany({});

    // İçerik sahibi kayıtları
    await tx.background.deleteMany({});
    await tx.profileMedia.deleteMany({});
    await tx.music.deleteMany({});
    await tx.cursorSet.deleteMany({});
    await tx.techStackItem.deleteMany({});
    await tx.nameOverlay.deleteMany({});
    await tx.fallingItem.deleteMany({});
    await tx.linkItem.deleteMany({});

    // Favicon bağını çöz (asset birazdan silinecek)
    await tx.siteSettings.update({ where: { id: 1 }, data: { faviconAssetId: null } });

    // Asset'leri sil (hepsi artık yetim)
    await deleteAssetsInTx(tx, assets, { skipInUse: true });

    // Entegrasyonlar: token/config/snapshot temizle, kapat
    await tx.integrationSetting.updateMany({
      data: {
        isEnabled: false,
        config: {},
        secretsEnc: null,
        status: 'DISCONNECTED',
        publicSnapshot: null,
        snapshotAt: null,
        lastSyncAt: null,
        lastSuccessAt: null,
        lastError: null,
      },
    });

    // Hero + başlıklar + Tech Stack + Hakkımda → varsayılan
    await tx.heroSettings.update({
      where: { id: 1 },
      data: {
        displayName: 'Lucas Vasquez',
        tagline: null,
        location: 'Samsung Galaxy',
        nameEffects: [],
        gradientFrom: '#a78bfa',
        gradientTo: '#f472b6',
        profileMode: 'ROTATION',
        fixedProfileMediaId: null,
      },
    });
    await tx.siteSettings.update({
      where: { id: 1 },
      data: {
        navbarTitle: '1uc44s GitHub',
        footerTechs: [],
      },
    });
    // Tech Stack bölümleri varsayılana: "My Tech Stack" + "My Security Skill" (ikisi de yayında değil).
    await tx.techStackGroup.deleteMany({});
    await tx.techStackGroup.createMany({ data: DEFAULT_TECH_STACK_GROUPS });
    await tx.aboutContent.update({
      where: { id: 1 },
      data: { title: 'Hakkımda', bodyMarkdown: '' },
    });

    // Varsayılan linkler yeniden eklensin diye tohum bayrağını temizle
    await tx.systemState.deleteMany({ where: { key: LINKS_SEED_FLAG } });

    // Tek varsayılan süper admin: fazladan süper adminler silinir, kalanın e-postası ayarlanır
    // (şifre ayrı betikle: koda yazılmaz). Silme, oturumları cascade; audit kayıtları SetNull ile korunur.
    const email = (values.email ?? DEFAULT_EMAIL).toLowerCase();
    await tx.adminUser.deleteMany({ where: { role: 'SUPER_ADMIN', email: { not: email } } });
    await tx.adminUser.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { email } });

    return { assets: assets.length };
  });

  if (assets.length) hooks.onDeletionQueued();

  const created = await createDefaultLinks();
  await prisma.systemState.create({
    data: { key: LINKS_SEED_FLAG, value: { at: new Date().toISOString() } },
  });
  invalidateSiteCache();

  console.warn(
    `Temizlendi — medya: ${counts.assets} asset, ` +
      `${backgrounds.length} arka plan, ${pfps.length} pfp, ${musics.length} müzik, ` +
      `${cursors.length} cursor, ${tech.length} tech stack, ${overlays.length} isim efekti, ` +
      `${falling.length} yağan öğe. Ziyaretçi/indirme kayıtları, entegrasyon token/snapshot'ları silindi. ` +
      `Hero, başlıklar, Tech Stack, Hakkımda varsayılan. ${created} varsayılan link eklendi. ` +
      `Admin e-postası ayarlandı (varsayılan şifre için: npm run admin:dev-set -w backend -- --default).`,
  );
});
