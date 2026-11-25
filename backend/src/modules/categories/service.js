// kategoriler. Benzersizlik `nameKey` (Türkçe uyumlu) ile;
// varsayılan kategori oluşturulmaz; kullanımdaki kategori ya yeniden atanır ya da silinemez.
import { normalizeKey } from '@my-portfolyo/shared';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { writeAudit } from '../audit/service.js';
import { invalidateSiteCache } from '../public/site.js';

const NAME_TAKEN = 'Bu adla bir kategori zaten var.';
const IN_USE = 'Bu kategori projelerde kullanılıyor.';

const toDto = (c) => ({
  id: c.id,
  name: c.name,
  isActive: c.isActive,
  sortOrder: c.sortOrder,
  projectCount: c._count?.projects ?? 0,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});

const withCount = { _count: { select: { projects: true } } };

const audit = (action, { adminId, ctx, entityId, metadata }) =>
  writeAudit({ adminId, action, entityType: 'Category', entityId, metadata, ctx });

const conflict = (err) => {
  if (err?.code === 'P2002') {
    throw new ConflictError(NAME_TAKEN, { details: [{ path: 'name', message: NAME_TAKEN }] });
  }
  throw err;
};

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: withCount,
  });
  return rows.map(toDto);
}

async function findOr404(id) {
  const row = await prisma.category.findUnique({ where: { id }, include: withCount });
  if (!row) throw new NotFoundError('Kategori bulunamadı.');
  return row;
}

export async function createCategory({ name, isActive = true }, { adminId, ctx }) {
  const last = await prisma.category.aggregate({ _max: { sortOrder: true } });
  const row = await prisma.category
    .create({
      data: {
        name,
        nameKey: normalizeKey(name),
        isActive,
        sortOrder: (last._max.sortOrder ?? -10) + 10,
      },
      include: withCount,
    })
    .catch(conflict);
  invalidateSiteCache();
  await audit('CREATED', { adminId, ctx, entityId: row.id, metadata: { name } });
  return toDto(row);
}

export async function updateCategory(id, input, { adminId, ctx }) {
  await findOr404(id);
  const row = await prisma.category
    .update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name, nameKey: normalizeKey(input.name) }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: withCount,
    })
    .catch(conflict);
  invalidateSiteCache();
  await audit('UPDATED', { adminId, ctx, entityId: id, metadata: { fields: Object.keys(input) } });
  return toDto(row);
}

export async function reorderCategories(ids, { adminId, ctx }) {
  const [matching, total] = await Promise.all([
    prisma.category.count({ where: { id: { in: ids } } }),
    prisma.category.count(),
  ]);
  if (new Set(ids).size !== ids.length || matching !== ids.length || total !== ids.length) {
    throw new ValidationError([
      { path: 'ids', message: 'Sıralama listesi güncel değil; sayfayı yenileyip tekrar dene.' },
    ]);
  }
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.category.update({ where: { id }, data: { sortOrder: index * 10 } }),
    ),
  );
  invalidateSiteCache();
  await audit('REORDERED', { adminId, ctx, metadata: { count: ids.length } });
}

/** Kullanımdaysa 409 IN_USE {projectCount}. */
export async function deleteCategory(id, { adminId, ctx }) {
  const row = await findOr404(id);
  const projectCount = row._count.projects;
  if (projectCount > 0) throw new AppError(409, 'IN_USE', IN_USE, { details: { projectCount } });
  // Yarış: arada proje bağlandıysa FK (Restrict) hatası → aynı 409.
  await prisma.category.delete({ where: { id } }).catch((err) => {
    if (err?.code === 'P2003') throw new AppError(409, 'IN_USE', IN_USE);
    throw err;
  });
  invalidateSiteCache();
  await audit('DELETED', { adminId, ctx, entityId: id, metadata: { name: row.name } });
}

/**
 * İlişkileri hedef kategoriye taşır (hedef null → ilişkiler kaldırılır) ve kategoriyi siler.
 * Dönüş: kategorisiz kalan yayındaki projeler (uyarı olarak).
 */
export async function reassignAndDelete(id, targetCategoryId, { adminId, ctx }) {
  const row = await findOr404(id);
  if (targetCategoryId === id) {
    throw new ValidationError([
      { path: 'targetCategoryId', message: 'Hedef, silinen kategoriden farklı olmalı.' },
    ]);
  }
  if (targetCategoryId !== null) {
    const target = await prisma.category.findUnique({ where: { id: targetCategoryId } });
    if (!target) {
      throw new ValidationError([
        { path: 'targetCategoryId', message: 'Hedef kategori bulunamadı.' },
      ]);
    }
  }

  const uncategorized = await prisma.$transaction(async (tx) => {
    const links = await tx.projectCategory.findMany({
      where: { categoryId: id },
      select: { projectId: true },
    });
    const projectIds = links.map((l) => l.projectId);
    if (targetCategoryId !== null && projectIds.length > 0) {
      await tx.projectCategory.createMany({
        data: projectIds.map((projectId) => ({ projectId, categoryId: targetCategoryId })),
        skipDuplicates: true,
      });
    }
    await tx.projectCategory.deleteMany({ where: { categoryId: id } });
    await tx.category.delete({ where: { id } });
    if (targetCategoryId !== null || projectIds.length === 0) return [];
    return tx.project.findMany({
      where: { id: { in: projectIds }, isPublished: true, categories: { none: {} } },
      select: { id: true, title: true },
      orderBy: { id: 'asc' },
    });
  });

  invalidateSiteCache();
  await audit('DELETED', {
    adminId,
    ctx,
    entityId: id,
    metadata: { name: row.name, reassignedTo: targetCategoryId, moved: row._count.projects },
  });
  return { uncategorizedPublished: uncategorized };
}
