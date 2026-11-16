// CMS.md §3.2–3.3, US-24, ROUTES.md §4.8 — projeler: slug (otomatik/elle, benzersiz), en az bir
// bağlantı, kategoriler, çoklu görsel (ilk = kapak), sıralama, yayın (`publishedAt` ilk yayında).
import { hasProjectLink, LINKS_REQUIRED_MESSAGE, slugify } from '@vasquez/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { deleteAssetsInTx, hooks, ingestUpload, toAssetDto } from '../media/service.js';
import { invalidateSiteCache } from '../public/site.js';

const SLUG_TAKEN = 'Bu adres başka bir projede kullanılıyor.';

const INCLUDE = {
  categories: {
    include: { category: { select: { id: true, name: true, isActive: true, sortOrder: true } } },
  },
  images: { include: { asset: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
};

const byCategoryOrder = (a, b) => a.sortOrder - b.sortOrder || a.id - b.id;

export function toAdminDto(p) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    demoUrl: p.demoUrl,
    videoUrl: p.videoUrl,
    githubUrl: p.githubUrl,
    isPublished: p.isPublished,
    sortOrder: p.sortOrder,
    viewCount: p.viewCount,
    publishedAt: p.publishedAt,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    categories: p.categories
      .map((pc) => pc.category)
      .sort(byCategoryOrder)
      .map(({ id, name, isActive }) => ({ id, name, isActive })),
    images: p.images.map((img) => ({
      id: img.id,
      alt: img.alt,
      sortOrder: img.sortOrder,
      asset: toAssetDto(img.asset),
    })),
  };
}

const audit = (action, { adminId, ctx, entityId, metadata }) =>
  writeAudit({ adminId, action, entityType: 'Project', entityId, metadata, ctx });

async function findOr404(id) {
  const row = await prisma.project.findUnique({ where: { id }, include: INCLUDE });
  if (!row) throw new NotFoundError('Proje bulunamadı.');
  return row;
}

export async function listProjects({ q, isPublished, categoryId, sort }) {
  const [field, dir] = (sort ?? 'sortOrder:asc').split(':');
  const rows = await prisma.project.findMany({
    where: {
      ...(q && { title: { contains: q, mode: 'insensitive' } }),
      ...(isPublished !== undefined && { isPublished }),
      ...(categoryId && { categories: { some: { categoryId } } }),
    },
    include: INCLUDE,
    orderBy: [{ [field]: dir }, { id: 'asc' }],
  });
  return rows.map(toAdminDto);
}

export const getProject = async (id) => toAdminDto(await findOr404(id));

/** İlk boş adres: slug, slug-2, slug-3… (excludeId: düzenlenen projenin kendisi). */
export async function suggestSlug(slug, excludeId) {
  const rows = await prisma.project.findMany({
    where: {
      OR: [{ slug }, { slug: { startsWith: `${slug}-` } }],
      ...(excludeId && { id: { not: excludeId } }),
    },
    select: { slug: true },
  });
  const taken = new Set(rows.map((p) => p.slug));
  if (!taken.has(slug)) return slug;
  for (let n = 2; ; n += 1) {
    const candidate = `${slug.slice(0, 120 - String(n).length - 1)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export async function slugCheck(raw, excludeId) {
  const slug = slugify(raw);
  const suggestion = await suggestSlug(slug, excludeId);
  return { slug, available: suggestion === slug && slug === raw, suggestion };
}

async function assertCategories(ids) {
  if (ids.length === 0) return;
  const count = await prisma.category.count({ where: { id: { in: ids } } });
  if (count !== ids.length) {
    throw new ValidationError([
      { path: 'categoryIds', message: 'Seçilen kategorilerden biri bulunamadı.' },
    ]);
  }
}

const slugConflict = (err) => {
  if (err?.code === 'P2002') {
    throw new ConflictError(SLUG_TAKEN, { details: [{ path: 'slug', message: SLUG_TAKEN }] });
  }
  throw err;
};

export async function createProject(input, { adminId, ctx }) {
  await assertCategories(input.categoryIds);
  // Elle verilen adres doluysa 409; boşsa başlıktan üretilir ve gerekirse -2, -3 eklenir.
  const slug = input.slug ?? (await suggestSlug(slugify(input.title)));
  const last = await prisma.project.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.project
    .create({
      data: {
        slug,
        title: input.title,
        description: input.description,
        demoUrl: input.demoUrl ?? null,
        videoUrl: input.videoUrl ?? null,
        githubUrl: input.githubUrl ?? null,
        isPublished: input.isPublished,
        publishedAt: input.isPublished ? new Date() : null,
        sortOrder: input.sortOrder ?? (last._max.sortOrder ?? -10) + 10,
        categories: { create: input.categoryIds.map((categoryId) => ({ categoryId })) },
      },
      include: INCLUDE,
    })
    .catch(slugConflict);
  invalidateSiteCache();
  await audit('CREATED', { adminId, ctx, entityId: row.id, metadata: { title: row.title, slug } });
  return toAdminDto(row);
}

export async function updateProject(id, input, { adminId, ctx }) {
  const current = await findOr404(id);
  const merged = { ...current, ...input };
  if (!hasProjectLink(merged)) {
    throw new ValidationError([{ path: 'links', message: LINKS_REQUIRED_MESSAGE }]);
  }
  if (input.categoryIds) await assertCategories(input.categoryIds);
  const { categoryIds, slug, ...fields } = input;
  // slug: null → başlıktan yeniden üret; undefined → dokunma
  const nextSlug =
    slug === undefined ? undefined : (slug ?? (await suggestSlug(slugify(merged.title), id)));

  const row = await prisma
    .$transaction(async (tx) => {
      if (categoryIds) {
        await tx.projectCategory.deleteMany({ where: { projectId: id } });
        if (categoryIds.length > 0) {
          await tx.projectCategory.createMany({
            data: categoryIds.map((categoryId) => ({ projectId: id, categoryId })),
          });
        }
      }
      return tx.project.update({
        where: { id },
        data: {
          ...fields,
          ...(nextSlug !== undefined && { slug: nextSlug }),
          ...(input.isPublished && !current.publishedAt && { publishedAt: new Date() }),
        },
        include: INCLUDE,
      });
    })
    .catch(slugConflict);
  invalidateSiteCache();
  await audit('UPDATED', { adminId, ctx, entityId: id, metadata: { fields: Object.keys(input) } });
  return toAdminDto(row);
}

export async function reorderProjects(ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    prisma.project.count({ where: { id: { in: ids } } }),
    prisma.project.count(),
  ]);
  if (new Set(ids).size !== ids.length || matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.project.update({ where: { id }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('REORDERED', { adminId, ctx, metadata: { count: ids.length } });
}

export async function deleteProject(id, { adminId, ctx }) {
  const current = await findOr404(id);
  await prisma.$transaction(async (tx) => {
    await tx.project.delete({ where: { id } }); // ProjectImage / ProjectCategory cascade
    await deleteAssetsInTx(
      tx,
      current.images.map((img) => img.asset),
      { skipInUse: true },
    );
  });
  hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('DELETED', { adminId, ctx, entityId: id, metadata: { title: current.title } });
}

// ───────────── Görseller ─────────────

/** Her dosya ayrı asset (PROJECT_IMAGE); sıra mevcutların sonuna eklenir. */
export async function addImages(id, files, { adminId, ctx }) {
  await findOr404(id);
  const last = await prisma.projectImage.aggregate({
    where: { projectId: id },
    _max: { sortOrder: true },
  });
  let order = (last._max.sortOrder ?? -10) + 10;
  const duplicates = [];
  for (const file of files) {
    const { asset, duplicateOf } = await ingestUpload({
      kind: 'PROJECT_IMAGE',
      file,
      adminId,
      ctx,
    });
    if (duplicateOf) duplicates.push({ file: file.originalname, ...duplicateOf });
    await prisma.projectImage.create({
      data: { projectId: id, assetId: asset.id, sortOrder: order },
    });
    order += 10;
  }
  invalidateSiteCache();
  await audit('IMAGES_ADDED', { adminId, ctx, entityId: id, metadata: { count: files.length } });
  return { project: await getProject(id), duplicates };
}

export async function reorderImages(id, ids, { adminId, ctx }) {
  const current = await findOr404(id);
  const own = new Set(current.images.map((img) => img.id));
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== own.size ||
    !ids.every((x) => own.has(x))
  ) {
    throw new ValidationError([
      { path: 'ids', message: 'Görsel listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((imageId, index) =>
      prisma.projectImage.update({ where: { id: imageId }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('IMAGES_REORDERED', { adminId, ctx, entityId: id, metadata: { count: ids.length } });
  return getProject(id);
}

async function findImageOr404(projectId, imageId) {
  const image = await prisma.projectImage.findFirst({
    where: { id: imageId, projectId },
    include: { asset: true },
  });
  if (!image) throw new NotFoundError('Görsel bulunamadı.');
  return image;
}

export async function updateImage(projectId, imageId, { alt }, { adminId, ctx }) {
  await findImageOr404(projectId, imageId);
  await prisma.projectImage.update({ where: { id: imageId }, data: { alt } });
  invalidateSiteCache();
  await audit('IMAGE_UPDATED', { adminId, ctx, entityId: projectId, metadata: { imageId } });
  return getProject(projectId);
}

export async function deleteImage(projectId, imageId, { adminId, ctx }) {
  const image = await findImageOr404(projectId, imageId);
  await prisma.$transaction(async (tx) => {
    await tx.projectImage.delete({ where: { id: imageId } });
    await deleteAssetsInTx(tx, [image.asset], { skipInUse: true });
  });
  hooks.onDeletionQueued();
  invalidateSiteCache();
  await audit('IMAGE_DELETED', { adminId, ctx, entityId: projectId, metadata: { imageId } });
  return getProject(projectId);
}
