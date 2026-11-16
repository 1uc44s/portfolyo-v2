// F16 — SRS FR-CKE-02/06, FR-DSH-01..03, FR-PRJ-03: çerez izni kaydı, analitik olayları,
// Dashboard özeti. Ham IP saklanmaz; ziyaretçi kimliği günlük tuzla HMAC (günler arası izlenemez).
import { hasPermission } from '@vasquez/shared';
import { prisma } from '../../lib/prisma.js';
import { addDays, istanbulDate, toDbDate } from '../../lib/time.js';
import { getMailSettings, isMailConfigured } from '../../mail/transport.js';
import { mediaUrl } from '../media/service.js';
import { visitorHashOf } from '../public/downloads.js';

/** FR-CKE-02 — anonim kanıt kaydı (IP yok). Bilinmeyen consentId → yeni kayıt. */
export async function recordConsent({ consentId, version, analytics }) {
  if (consentId) {
    const updated = await prisma.cookieConsentRecord.updateMany({
      where: { id: consentId },
      data: { version, analytics },
    });
    if (updated.count > 0) return { consentId };
  }
  const row = await prisma.cookieConsentRecord.create({ data: { version, analytics } });
  return { consentId: row.id };
}

/**
 * FR-CKE-06 — PAGE_VIEW her seferinde; PROJECT_VIEW ziyaretçi+proje+gün için bir kez ve yalnızca
 * o zaman viewCount +1. Bilinmeyen/yayında olmayan proje sessizce yok sayılır.
 */
export async function recordEvent(input, req, now = Date.now()) {
  const visitorHash = await visitorHashOf(req);
  const day = toDbDate(istanbulDate(now));
  if (input.type === 'PAGE_VIEW') {
    await prisma.analyticsEvent.create({
      data: { type: 'PAGE_VIEW', path: input.path, visitorHash, day },
    });
    return;
  }
  const project = await prisma.project.findFirst({
    where: { slug: input.projectSlug, isPublished: true },
    select: { id: true },
  });
  if (!project) return;
  const lockKey = `pv:${project.id}:${visitorHash}`;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const seen = await tx.analyticsEvent.findFirst({
      where: { type: 'PROJECT_VIEW', projectId: project.id, visitorHash, day },
      select: { id: true },
    });
    if (seen) return;
    await tx.analyticsEvent.create({
      data: { type: 'PROJECT_VIEW', path: input.path, projectId: project.id, visitorHash, day },
    });
    await tx.project.update({ where: { id: project.id }, data: { viewCount: { increment: 1 } } });
  });
}

// ───────────────────────────── Dashboard ─────────────────────────────

/** Günlük benzersiz ziyaretçi (PAGE_VIEW) — gün → sayı. */
async function dailyUniques() {
  const rows = await prisma.$queryRaw`
    SELECT day, COUNT(DISTINCT visitor_hash)::int AS count
    FROM analytics_events
    WHERE type = 'PAGE_VIEW'
    GROUP BY day`;
  return new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.count)]));
}

const sumSince = (map, fromDay) =>
  [...map.entries()].reduce((acc, [day, c]) => (day >= fromDay ? acc + c : acc), 0);

async function visitorStats(rangeDays, now) {
  const today = istanbulDate(now);
  const all = await dailyUniques();
  const from = addDays(today, -(rangeDays - 1));
  const series = [];
  for (let i = 0; i < rangeDays; i += 1) {
    const day = addDays(from, i);
    series.push({ day, count: all.get(day) ?? 0 });
  }
  return {
    total: sumSince(all, '0000-00-00'),
    today: all.get(today) ?? 0,
    week: sumSince(all, addDays(today, -6)),
    month: sumSince(all, addDays(today, -29)),
    series,
  };
}

const thumbOf = (asset) =>
  asset?.processingStatus === 'READY'
    ? mediaUrl(asset, asset.thumbnailKey ? 'thumb' : 'main')
    : null;

async function topDownloads(model) {
  const rows = await model.findMany({
    where: { downloadCount: { gt: 0 } },
    orderBy: [{ downloadCount: 'desc' }, { id: 'asc' }],
    take: 5,
    include: { asset: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    count: r.downloadCount,
    thumbUrl: thumbOf(r.asset),
  }));
}

async function topProjects() {
  const rows = await prisma.project.findMany({
    where: { viewCount: { gt: 0 } },
    orderBy: [{ viewCount: 'desc' }, { id: 'asc' }],
    take: 5,
    select: { id: true, title: true, slug: true, viewCount: true, isPublished: true },
  });
  return rows.map(({ viewCount, ...p }) => ({ ...p, count: viewCount }));
}

async function recentAudit(admin) {
  if (!hasPermission(admin, 'audit:read')) return [];
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { admin: { select: { email: true, displayName: true } } },
  });
  return rows.map((r) => ({
    id: String(r.id),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actor: r.admin?.displayName || r.admin?.email || 'Sistem',
    createdAt: r.createdAt,
  }));
}

async function storageUsage() {
  const rows = await prisma.mediaAsset.groupBy({
    by: ['kind'],
    _sum: { sizeBytes: true },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ kind: r.kind, bytes: Number(r._sum.sizeBytes ?? 0), count: r._count._all }))
    .sort((a, b) => b.bytes - a.bytes);
}

async function warnings(admin, integrations) {
  const out = [];
  const me = await prisma.adminUser.findUnique({
    where: { id: admin.id },
    select: { totpEnabled: true },
  });
  if (me && !me.totpEnabled) {
    out.push({ code: 'TWO_FACTOR_OFF', message: 'Hesabında iki aşamalı doğrulama kapalı.' });
  }
  if (!isMailConfigured(await getMailSettings())) {
    out.push({
      code: 'SMTP_MISSING',
      message: 'E-posta gönderimi ayarlanmadı. Şifremi unuttum e-postaları gönderilemez.',
    });
  }
  for (const i of integrations) {
    if (i.isEnabled && i.status === 'ERROR') {
      out.push({
        code: 'INTEGRATION_ERROR',
        message: `${i.label} entegrasyonu hata veriyor: ${i.lastError ?? 'bilinmeyen hata'}`,
      });
    }
  }
  const failed = await prisma.mediaAsset.count({ where: { processingStatus: 'FAILED' } });
  if (failed > 0) {
    out.push({ code: 'MEDIA_FAILED', message: `${failed} medya dosyası işlenemedi.` });
  }
  return out;
}

const LABELS = { DISCORD: 'Discord', SPOTIFY: 'Spotify', GITHUB: 'GitHub' };

export async function dashboardSummary(admin, rangeDays, now = Date.now()) {
  const rows = await prisma.integrationSetting.findMany({
    select: { provider: true, isEnabled: true, status: true, lastSyncAt: true, lastError: true },
  });
  const integrations = ['DISCORD', 'SPOTIFY', 'GITHUB'].map((provider) => {
    const r = rows.find((x) => x.provider === provider);
    return {
      provider: provider.toLowerCase(),
      label: LABELS[provider],
      isEnabled: r?.isEnabled ?? false,
      status: r?.status ?? 'DISCONNECTED',
      lastSyncAt: r?.lastSyncAt ?? null,
      lastError: r?.lastError ?? null,
    };
  });
  const [visitors, topWallpapers, topPfps, projects, audit, storage, warn] = await Promise.all([
    visitorStats(rangeDays, now),
    topDownloads(prisma.background),
    topDownloads(prisma.profileMedia),
    topProjects(),
    recentAudit(admin),
    storageUsage(),
    warnings(admin, integrations),
  ]);
  return {
    visitors,
    topWallpapers,
    topPfps,
    topProjects: projects,
    recentAudit: audit,
    integrations,
    storage,
    warnings: warn,
  };
}

/** SRS §11 — saklama: tek iş, her biri bağımsız; sayılar döner. */
export async function runRetention(now = new Date()) {
  const ago = (days) => new Date(now.getTime() - days * 24 * 60 * 60_000);
  const monthsAgo = (months) => {
    const d = new Date(now);
    d.setUTCMonth(d.getUTCMonth() - months);
    return d;
  };
  const [analytics, downloads, audit, sessions, resets] = await Promise.all([
    prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: monthsAgo(13) } } }),
    prisma.downloadEvent.updateMany({
      where: { createdAt: { lt: ago(90) }, visitorHash: { not: null } },
      data: { visitorHash: null },
    }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: monthsAgo(24) } } }),
    prisma.adminSession.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: ago(30) } }, { revokedAt: { lt: ago(30) } }],
      },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: ago(7) } }, { usedAt: { lt: ago(7) } }] },
    }),
  ]);
  return {
    analyticsEvents: analytics.count,
    downloadHashesCleared: downloads.count,
    auditLogs: audit.count,
    sessions: sessions.count,
    resetTokens: resets.count,
  };
}
