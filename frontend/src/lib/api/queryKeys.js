// query anahtarları tek yerde.
export const queryKeys = {
  health: ['health'],
  site: ['public', 'site'],
  downloads: (kind) => ['public', 'downloads', kind],
  projects: ['public', 'projects'],
  links: ['public', 'links'],
  projectCategories: ['public', 'categories'],
  project: (slug) => ['public', 'project', slug],
  legal: (key) => ['public', 'legal', key],
  status: (slug) => ['public', 'status', slug],
  techStack: ['public', 'tech-stack'],
};
