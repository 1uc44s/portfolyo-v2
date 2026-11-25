// proje editörü: solda form, sağda canlı kart önizlemesi. Slug başlıktan otomatik;
// "Elle düzenle" ile kilitlenir ve anlık kontrol edilir. Görseller kayıt oluştuktan sonra eklenir.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ExternalLink, Plus } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import {
  excerptOf,
  hasPermission,
  PROJECT_DESCRIPTION_MAX,
  PROJECT_SLUG_MAX,
  PROJECT_TITLE_MAX,
  projectCreateSchema,
  slugify,
} from '@my-portfolyo/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { buttonVariants } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { ProjectCard } from '@/features/projects/ProjectCard.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { cn } from '@/lib/utils';
import { MarkdownEditor } from '../../components/MarkdownEditor.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SettingsCard } from '../../components/SettingsCard.jsx';
import { adminKeys, projectsApi } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';
import { useAuthedMedia } from '../../lib/useAuthedMedia.js';
import { CategoryDialog } from '../categories/CategoryDialog.jsx';
import { useCategories } from '../categories/CategoriesPage.jsx';
import { ProjectImages } from './ProjectImages.jsx';

const FIELDS = ['title', 'slug', 'description', 'demoUrl', 'videoUrl', 'githubUrl', 'categoryIds'];

const defaultsOf = (p) => ({
  title: p?.title ?? '',
  slug: p?.slug ?? '',
  description: p?.description ?? '',
  demoUrl: p?.demoUrl ?? '',
  videoUrl: p?.videoUrl ?? '',
  githubUrl: p?.githubUrl ?? '',
  categoryIds: p?.categories.map((c) => c.id) ?? [],
  isPublished: p?.isPublished ?? false,
});

function useSlugCheck(slug, enabled, excludeId) {
  const [debounced, setDebounced] = useState(slug);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(slug), 350);
    return () => clearTimeout(t);
  }, [slug]);
  return useQuery({
    queryKey: ['admin', 'projects', 'slug-check', debounced, excludeId],
    queryFn: () => projectsApi.slugCheck(debounced, excludeId),
    enabled: enabled && Boolean(debounced),
    staleTime: 5_000,
  });
}

function CategoryPicker({ value, onChange, disabled }) {
  const categories = useCategories();
  const [creating, setCreating] = useState(false);
  const list = categories.data ?? [];
  return (
    <fieldset className="grid gap-2" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium">Kategoriler</legend>
      <div className="flex flex-wrap gap-2">
        {list.map((c) => {
          const active = value.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(active ? value.filter((id) => id !== c.id) : [...value, c.id])
              }
              className={cn(
                'min-h-8 rounded-full border px-3 text-sm transition-colors',
                active
                  ? 'bg-primary text-primary-foreground border-transparent'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                !c.isActive && 'border-dashed',
              )}
              title={c.isActive ? undefined : 'Pasif: public sayfada görünmez'}
            >
              {c.name}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex min-h-8 items-center gap-1 rounded-full border border-dashed px-3 text-sm"
        >
          <Plus aria-hidden="true" className="size-3.5" />
          Yeni kategori
        </button>
      </div>
      <CategoryDialog
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(saved) => onChange([...value, saved.id])}
      />
    </fieldset>
  );
}

function Preview({ control, project }) {
  const [title, description, categoryIds, isPublished] = useWatch({
    control,
    name: ['title', 'description', 'categoryIds', 'isPublished'],
  });
  const categories = useCategories().data ?? [];
  const first = project?.images[0]?.asset;
  const cover = useAuthedMedia(first ? (first.thumbUrl ?? first.previewUrl) : null);
  const card = {
    slug: 'onizleme',
    title: title || 'Proje başlığı',
    excerpt: excerptOf(description),
    cover: cover.src ? { url: cover.src, alt: '' } : null,
    categories: categories.filter((c) => categoryIds.includes(c.id) && c.isActive),
  };
  return (
    <div className="grid gap-2">
      <p className="type-meta text-muted-foreground">
        Kart önizlemesi · {isPublished ? 'Yayında' : 'Taslak'}
      </p>
      <div className="scene-fallback rounded-[var(--radius-xl)] border p-5">
        <ProjectCard project={card} href={null} className="mx-auto max-w-sm" />
      </div>
    </div>
  );
}

function ProjectForm({ project, canEdit }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = !project;
  const [slugLocked, setSlugLocked] = useState(!isNew);
  const form = useForm({
    resolver: zodResolver(projectCreateSchema),
    defaultValues: defaultsOf(project),
  });
  const { errors, isSubmitting, isDirty } = form.formState;
  const [title, slug] = useWatch({ control: form.control, name: ['title', 'slug'] });
  const autoSlug = slugify(title);
  const check = useSlugCheck(slugLocked ? slug : autoSlug, canEdit, project?.id);

  const onSubmit = form.handleSubmit(async (values) => {
    const body = { ...values, slug: slugLocked ? values.slug : null };
    try {
      const saved = isNew
        ? await projectsApi.create(body)
        : await projectsApi.update(project.id, body);
      queryClient.setQueryData(adminKeys.project(saved.id), saved);
      queryClient.invalidateQueries({ queryKey: adminKeys.projects() });
      queryClient.invalidateQueries({ queryKey: adminKeys.categories });
      if (isNew) {
        toast.success('Proje oluşturuldu. Şimdi görsel ekleyebilirsin.');
        navigate(`/admin/projects/${saved.id}`, { replace: true });
      } else {
        toast.success('Proje kaydedildi.');
        form.reset(defaultsOf(saved));
        setSlugLocked(true);
      }
    } catch (error) {
      handleFormError(error, form.setError, [...FIELDS, 'links']);
    }
  });

  const slugHint = (() => {
    if (!check.data) return `Adres: /projects/${slugLocked ? slug || '…' : autoSlug}`;
    if (check.data.available || check.data.suggestion === (slugLocked ? slug : project?.slug)) {
      return `Adres: /projects/${check.data.suggestion}`;
    }
    return slugLocked
      ? `Bu adres kullanımda. Öneri: ${check.data.suggestion}`
      : `Adres: /projects/${check.data.suggestion}`;
  })();

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]"
    >
      <div className="grid gap-6">
        <SettingsCard
          title="Temel"
          footer={
            canEdit && (
              <SubmitButton pending={isSubmitting} disabled={!isNew && !isDirty && slugLocked}>
                {isNew ? 'Oluştur' : 'Kaydet'}
              </SubmitButton>
            )
          }
        >
          <fieldset disabled={!canEdit} className="grid gap-5">
            <FormField label="Başlık" error={errors.title?.message}>
              <Input maxLength={PROJECT_TITLE_MAX} {...form.register('title')} />
            </FormField>

            <FormField
              label="Adres (slug)"
              error={errors.slug?.message}
              description={slugHint}
              labelAction={
                <button
                  type="button"
                  className="text-primary text-xs underline-offset-2 hover:underline"
                  onClick={() => {
                    if (!slugLocked) form.setValue('slug', check.data?.suggestion ?? autoSlug);
                    setSlugLocked(!slugLocked);
                  }}
                >
                  {slugLocked ? 'Başlıktan üret' : 'Elle düzenle'}
                </button>
              }
            >
              {slugLocked ? (
                <Input
                  maxLength={PROJECT_SLUG_MAX}
                  spellCheck={false}
                  autoCapitalize="off"
                  {...form.register('slug')}
                />
              ) : (
                <Input value={check.data?.suggestion ?? autoSlug} readOnly aria-readonly="true" />
              )}
            </FormField>

            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormField
                  label="Açıklama"
                  error={errors.description?.message}
                  description="Markdown. Kart özeti ilk paragraftan otomatik çıkarılır (160 karakter)."
                >
                  <MarkdownEditor
                    value={field.value}
                    onChange={field.onChange}
                    maxLength={PROJECT_DESCRIPTION_MAX}
                  />
                </FormField>
              )}
            />

            <Controller
              control={form.control}
              name="categoryIds"
              render={({ field }) => (
                <CategoryPicker value={field.value} onChange={field.onChange} disabled={!canEdit} />
              )}
            />

            <fieldset className="grid gap-3">
              <legend className="mb-1 text-sm font-medium">Bağlantılar</legend>
              {errors.links?.message && (
                <p role="alert" className="text-danger text-sm">
                  {errors.links.message}
                </p>
              )}
              <FormField label="Demo" error={errors.demoUrl?.message}>
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  {...form.register('demoUrl')}
                />
              </FormField>
              <FormField label="Video" error={errors.videoUrl?.message}>
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  {...form.register('videoUrl')}
                />
              </FormField>
              <FormField label="GitHub" error={errors.githubUrl?.message}>
                <Input
                  type="url"
                  inputMode="url"
                  placeholder="https://github.com/…"
                  {...form.register('githubUrl')}
                />
              </FormField>
            </fieldset>

            <Controller
              control={form.control}
              name="isPublished"
              render={({ field }) => (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="project-published" className="block font-normal">
                    Yayında
                    <span className="text-muted-foreground block text-xs">
                      Kapalıyken proje public sayfada görünmez, adresi 404 verir.
                    </span>
                  </Label>
                  <Switch
                    id="project-published"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </div>
              )}
            />
          </fieldset>
        </SettingsCard>

        <SettingsCard
          title="Görseller"
          description={isNew ? 'Görsel eklemek için önce projeyi oluştur.' : undefined}
        >
          {project ? (
            <ProjectImages project={project} canEdit={canEdit} />
          ) : (
            <p className="text-muted-foreground text-sm">
              Proje kaydedildikten sonra görselleri buraya sürükleyebilirsin.
            </p>
          )}
        </SettingsCard>
      </div>
      <div className="grid gap-4 xl:sticky xl:top-24">
        <Preview control={form.control} project={project} />
        {project?.isPublished && (
          <a
            href={`/projects/${project.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <ExternalLink aria-hidden="true" />
            Public sayfayı aç
          </a>
        )}
      </div>
    </form>
  );
}

export function ProjectEditorPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const projectId = isNew ? null : Number(id);
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'projects:write');
  const query = useQuery({
    queryKey: adminKeys.project(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: !isNew && Number.isInteger(projectId),
  });

  useEffect(() => {
    document.title = `${isNew ? 'Yeni proje' : (query.data?.title ?? 'Proje')} · Yönetim`;
  }, [isNew, query.data?.title]);

  return (
    <>
      <PageHeader
        title={isNew ? 'Proje oluştur' : (query.data?.title ?? 'Proje')}
        description="Başlık, açıklama ve en az bir bağlantı zorunlu."
        actions={
          <Link to="/admin/projects" className={buttonVariants({ variant: 'ghost' })}>
            <ArrowLeft aria-hidden="true" />
            Projeler
          </Link>
        }
      />
      {isNew && <ProjectForm project={null} canEdit={canEdit} />}
      {!isNew && query.isPending && <Skeleton className="h-[560px] rounded-[var(--radius-lg)]" />}
      {!isNew && query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {!isNew && query.isSuccess && (
        <ProjectForm key={query.data.id} project={query.data} canEdit={canEdit} />
      )}
    </>
  );
}
