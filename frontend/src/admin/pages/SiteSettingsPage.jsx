// CMS.md §9 — Site Ayarları: Genel · Hakkımda · Footer teknolojileri (bölüm bazlı kaydetme).
// Favicon Genel kartında (F5-02/F6, FaviconSection). "Bugünün içerikleri" F8'de eklenecek.
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  ABOUT_MAX_LENGTH,
  aboutSchema,
  footerTechSchema,
  FOOTER_TECHS_MAX,
  hasPermission,
} from '@vasquez/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { DragHandle, SortableList } from '@/components/common/SortableList.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { adminKeys, settingsApi } from '../lib/adminApi.js';
import { handleFormError } from '../lib/forms.js';
import { MarkdownEditor } from '../components/MarkdownEditor.jsx';
import { PageHeader } from '../components/PageHeader.jsx';
import { SettingsCard } from '../components/SettingsCard.jsx';
import { FaviconSection } from './FaviconSection.jsx';
import { TodayContentCard } from './TodayContentCard.jsx';

const generalSchema = z.object({
  navbarTitle: z.string().trim().min(1, 'Navbar başlığı zorunlu.').max(40),
});
const techsSchema = z.object({
  footerTechs: z.array(footerTechSchema).max(FOOTER_TECHS_MAX),
});

function useSave(setError, fields) {
  const queryClient = useQueryClient();
  return async (request, message) => {
    try {
      queryClient.setQueryData(adminKeys.settings, await request());
      toast.success(message);
      return true;
    } catch (error) {
      handleFormError(error, setError, fields);
      return false;
    }
  };
}

function SaveButton({ form }) {
  return (
    <SubmitButton pending={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
      Kaydet
    </SubmitButton>
  );
}

function GeneralCard({ settings, canEdit }) {
  const form = useForm({
    resolver: zodResolver(generalSchema),
    defaultValues: { navbarTitle: settings.navbarTitle },
  });
  const save = useSave(form.setError, ['navbarTitle']);
  const onSubmit = form.handleSubmit(async (values) => {
    if (await save(() => settingsApi.update(values), 'Genel ayarlar kaydedildi.')) {
      form.reset(values);
    }
  });
  return (
    <form noValidate onSubmit={onSubmit}>
      <SettingsCard
        title="Genel"
        description="Navbar'da ve sekme başlığında görünen site adı ve tarayıcı sekmesi simgesi."
        footer={canEdit && <SaveButton form={form} />}
      >
        <div className="grid gap-5">
          <fieldset disabled={!canEdit} className="grid max-w-md gap-5">
            <FormField label="Navbar başlığı" error={form.formState.errors.navbarTitle?.message}>
              <Input maxLength={40} {...form.register('navbarTitle')} />
            </FormField>
          </fieldset>
          <FaviconSection settings={settings} canEdit={canEdit} />
        </div>
      </SettingsCard>
    </form>
  );
}

function AboutCard({ settings, canEdit }) {
  const form = useForm({ resolver: zodResolver(aboutSchema), defaultValues: settings.about });
  const save = useSave(form.setError, ['title', 'bodyMarkdown']);
  const onSubmit = form.handleSubmit(async (values) => {
    if (await save(() => settingsApi.updateAbout(values), 'Hakkımda kaydedildi.')) {
      form.reset(values);
    }
  });
  const { errors } = form.formState;
  return (
    <form noValidate onSubmit={onSubmit}>
      <SettingsCard
        title="Hakkımda"
        description="Markdown desteklenir. İçerik boşsa bölüm sitede gösterilmez."
        footer={canEdit && <SaveButton form={form} />}
      >
        <fieldset disabled={!canEdit} className="grid gap-5">
          <FormField label="Başlık" error={errors.title?.message} className="max-w-md">
            <Input maxLength={80} {...form.register('title')} />
          </FormField>
          <Controller
            control={form.control}
            name="bodyMarkdown"
            render={({ field }) => (
              <FormField label="İçerik" error={errors.bodyMarkdown?.message}>
                <MarkdownEditor
                  value={field.value}
                  onChange={field.onChange}
                  maxLength={ABOUT_MAX_LENGTH}
                />
              </FormField>
            )}
          />
        </fieldset>
      </SettingsCard>
    </form>
  );
}

function TechsCard({ settings, canEdit }) {
  const form = useForm({
    resolver: zodResolver(techsSchema),
    defaultValues: {
      footerTechs: settings.footerTechs.map((t) => ({ label: t.label, icon: t.icon ?? '' })),
    },
  });
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'footerTechs',
  });
  const save = useSave(form.setError, []);
  const onSubmit = form.handleSubmit(async ({ footerTechs }) => {
    const payload = footerTechs.map((t) => ({ label: t.label, icon: t.icon ?? null }));
    if (await save(() => settingsApi.update({ footerTechs: payload }), 'Footer kaydedildi.')) {
      form.reset({ footerTechs });
    }
  });
  const errors = form.formState.errors.footerTechs;

  return (
    <form noValidate onSubmit={onSubmit}>
      <SettingsCard
        title="Footer teknolojileri"
        description="Sitenin altında gösterilen teknoloji listesi. İkon opsiyoneldir ve yalnızca React Icons kütüphanesinden seçilir: react-icons.github.io/react-icons adresinde ikonu bulup bileşen adını yaz (ör. SiReact, FaGithub)."
        footer={
          canEdit && (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={fields.length >= FOOTER_TECHS_MAX}
                onClick={() => append({ label: '', icon: '' })}
              >
                <Plus aria-hidden="true" />
                Ekle
              </Button>
              <SaveButton form={form} />
            </>
          )
        }
      >
        {fields.length === 0 ? (
          <p className="text-muted-foreground text-sm">Henüz teknoloji eklenmedi.</p>
        ) : (
          <fieldset disabled={!canEdit}>
            <SortableList
              items={fields}
              aria-label="Footer teknolojileri sırası"
              className="gap-3"
              disabled={!canEdit}
              labelOf={(field) => {
                const index = fields.indexOf(field);
                return form.getValues(`footerTechs.${index}.label`) || `${index + 1}. teknoloji`;
              }}
              onReorder={(_next, { from, to }) => move(from, to)}
              renderItem={(field, { handle }) => (
                <FooterTechRow
                  index={fields.indexOf(field)}
                  handle={handle}
                  form={form}
                  errors={errors}
                  onRemove={remove}
                />
              )}
            />
          </fieldset>
        )}
      </SettingsCard>
    </form>
  );
}

function FooterTechRow({ index, handle, form, errors, onRemove }) {
  return (
    <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
      <DragHandle handle={handle} label={`${index + 1}. teknoloji`} className="mt-6" />
      <FormField label="Etiket" error={errors?.[index]?.label?.message} className="min-w-40 flex-1">
        <Input maxLength={40} {...form.register(`footerTechs.${index}.label`)} />
      </FormField>
      <FormField
        label="İkon (React Icons adı)"
        error={errors?.[index]?.icon?.message}
        className="min-w-36 flex-1"
      >
        <Input placeholder="SiReact" {...form.register(`footerTechs.${index}.icon`)} />
      </FormField>
      <div className="flex gap-0.5 pt-6">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-danger"
          aria-label={`${index + 1}. teknolojiyi kaldır`}
          onClick={() => onRemove(index)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function SiteSettingsPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'settings:write');
  const settings = useQuery({ queryKey: adminKeys.settings, queryFn: settingsApi.get });

  useEffect(() => {
    document.title = 'Site Ayarları · Yönetim';
  }, []);

  return (
    <>
      <PageHeader
        title="Site Ayarları"
        description="Sitenin genel kimliği, Hakkımda içeriği ve footer. Her bölüm ayrı kaydedilir."
      />
      {settings.isPending && (
        <div className="grid max-w-3xl gap-4">
          <Skeleton className="h-48 rounded-[var(--radius-lg)]" />
          <Skeleton className="h-96 rounded-[var(--radius-lg)]" />
        </div>
      )}
      {settings.isError && <ErrorState onRetry={() => settings.refetch()} />}
      {settings.isSuccess && (
        <div className="grid max-w-3xl gap-6">
          <GeneralCard settings={settings.data} canEdit={canEdit} />
          <TodayContentCard canEdit={canEdit} />
          <AboutCard settings={settings.data} canEdit={canEdit} />
          <TechsCard settings={settings.data} canEdit={canEdit} />
        </div>
      )}
    </>
  );
}
