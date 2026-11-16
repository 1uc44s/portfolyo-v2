// ROUTES.md §3 — GET /api/public/legal/:key (FR-CNT-04). Düzenleme ekranı F16 (Sistem > Yasal metinler).
import { NotFoundError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';

/** URL anahtarı → LegalDocKey. */
export const LEGAL_SLUGS = Object.freeze({
  'kvkk-notice': 'KVKK_NOTICE',
  'cookie-policy': 'COOKIE_POLICY',
});

export async function getPublicLegal(key) {
  const doc = await prisma.legalDocument.findUnique({
    where: { key },
    select: { title: true, bodyMarkdown: true, version: true, updatedAt: true },
  });
  if (!doc) throw new NotFoundError('Metin bulunamadı.');
  return doc;
}
