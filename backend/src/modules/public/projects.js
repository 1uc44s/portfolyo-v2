// yayındaki projeler (sortOrder ASC, id ASC), detay ve filtre
// kategorileri. Yalnızca aktif kategoriler ve READY görseller döner; iç alanlar (id, sayaçlar) yok.
import { excerptOf } from '@my-portfolyo/shared';
import { NotFoundError } from '../../lib/httpError.js';
import { prisma } from '../../lib/prisma.js';
import { mediaUrl } from '../media/service.js';

const READY = { asset: { processingStatus: 'READY' } };
const ORDER = [{ sortOrder: 'asc' }, { id: 'asc' }];

const categoriesInclude = {
  where: { category: { isActive: true } },
  include: { category: { select: { id: true, name: true, sortOrder: true } } },
};

const imageSelect = {
  alt: true,
  asset: { select: { id: true, thumbnailKey: true, width: true, height: true } },
};

const toImage = (img, title) => ({
  url: mediaUrl(img.asset),
  thumbUrl: img.asset.thumbnailKey ? mediaUrl(img.asset, 'thumb') : mediaUrl(img.asset),
  width: img.asset.width,
  height: img.asset.height,
  alt: img.alt || title,
});

const toCategories = (links) =>
  links
    .map((pc) => pc.category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map(({ id, name }) => ({ id, name }));

export async function listPublicProjects({ category } = {}) {
  const rows = await prisma.project.findMany({
    where: {
      isPublished: true,
      ...(category && {
        categories: { some: { categoryId: category, category: { isActive: true } } },
      }),
    },
    orderBy: ORDER,
    select: {
      slug: true,
      title: true,
      description: true,
      categories: categoriesInclude,
      images: { where: READY, orderBy: ORDER, take: 1, select: imageSelect },
    },
  });
  return rows.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: excerptOf(p.description),
    cover: p.images[0] ? toImage(p.images[0], p.title) : null,
    categories: toCategories(p.categories),
  }));
}

export async function getPublicProject(slug) {
  const p = await prisma.project.findFirst({
    where: { slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      description: true,
      demoUrl: true,
      videoUrl: true,
      githubUrl: true,
      categories: categoriesInclude,
      images: { where: READY, orderBy: ORDER, select: imageSelect },
    },
  });
  if (!p) throw new NotFoundError('Proje bulunamadı.');
  return {
    slug: p.slug,
    title: p.title,
    descriptionMarkdown: p.description,
    excerpt: excerptOf(p.description),
    images: p.images.map((img) => toImage(img, p.title)),
    categories: toCategories(p.categories),
    links: { demo: p.demoUrl, video: p.videoUrl, github: p.githubUrl },
  };
}

/** Filtre çipleri: yayında projesi olan aktif kategoriler, admin sırasıyla. */
export function listPublicCategories() {
  return prisma.category.findMany({
    where: { isActive: true, projects: { some: { project: { isPublished: true } } } },
    orderBy: ORDER,
    select: { id: true, name: true },
  });
}
