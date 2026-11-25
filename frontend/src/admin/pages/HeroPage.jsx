// Hero formu + canlı önizleme (gerçek public Hero bileşeni, düşük efekt anahtarı);
// profil görseli: günlük rotasyon veya sabit profil fotoğrafı (HeroProfileField).
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  HERO_GRADIENT_DEFAULTS,
  hasPermission,
  heroSchema,
  NAME_EFFECTS,
} from '@my-portfolyo/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Hero } from '@/features/hero/Hero.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { cn } from '@/lib/utils';
import { adminKeys, heroApi, rotationApi } from '../lib/adminApi.js';
import { handleFormError } from '../lib/forms.js';
import { PageHeader } from '../components/PageHeader.jsx';
import { HeroProfileField, useProfileOptions } from './HeroProfileField.jsx';
import { SettingsCard } from '../components/SettingsCard.jsx';
import { FallingItemsCard } from './FallingItemsCard.jsx';

const EFFECT_LABELS = {
  NEON: 'Neon',
  GRADIENT: 'Gradyan (hareketsiz)',
  GRADIENT_ANIMATED: 'Gradyan (hareketli)',
  OVERLAY: 'İsim Efekti',
};
// İki gradyan aynı renkleri kullanır; birlikte seçilemez (biri seçilince diğeri kalkar).
const EXCLUSIVE = { GRADIENT: 'GRADIENT_ANIMATED', GRADIENT_ANIMATED: 'GRADIENT' };

function toggleEffect(list, effect) {
  if (list.includes(effect)) return list.filter((e) => e !== effect);
  return [...list.filter((e) => e !== EXCLUSIVE[effect]), effect];
}

function ColorField({ form, name, label }) {
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} error={fieldState.error?.message}>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label={`${label} seçici`}
              value={/^#[0-9a-f]{6}$/i.test(field.value ?? '') ? field.value : '#000000'}
              onChange={(e) => field.onChange(e.target.value)}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border bg-transparent p-1"
            />
            <Input
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              onBlur={field.onBlur}
              maxLength={7}
              spellCheck={false}
              className="font-mono uppercase"
            />
          </div>
        </FormField>
      )}
    />
  );
}

const previewOf = (item) => (item?.previewUrl ? { type: 'IMAGE', url: item.previewUrl } : null);

function Preview({ control }) {
  const [lowPreview, setLowPreview] = useState(false);
  const [displayName, tagline, location, effects, profileMode, fixedId, gradientFrom, gradientTo] =
    useWatch({
      control,
      name: [
        'displayName',
        'tagline',
        'location',
        'nameEffects',
        'profileMode',
        'fixedProfileMediaId',
        'gradientFrom',
        'gradientTo',
      ],
    });
  const options = useProfileOptions();
  const admin = useAuthStore((st) => st.admin);
  const rotation = useQuery({
    queryKey: adminKeys.rotation,
    queryFn: rotationApi.get,
    // PFP (rotasyon modu) ve günün isim GIF'i önizlemesi için.
    enabled: hasPermission(admin, 'settings:read'),
  });
  const fixed =
    profileMode === 'FIXED' ? options.data?.find((option) => option.id === fixedId) : null;
  // Rotasyon modunda bugünün PFP seçimi; yetki yoksa baş harf avatarı.
  const profile = fixed
    ? { type: 'IMAGE', url: fixed.thumbUrl }
    : profileMode === 'ROTATION'
      ? previewOf(rotation.data?.categories?.PFP?.today?.item)
      : null;
  return (
    <div className="grid gap-3">
      <div className="scene-fallback relative grid min-h-[340px] place-items-center overflow-hidden rounded-[var(--radius-xl)] border px-6 py-12">
        <Hero
          as="p"
          forceLowEffects={lowPreview}
          hero={{
            displayName: displayName || 'İsim',
            tagline,
            location,
            nameEffects: effects,
            gradientFrom,
            gradientTo,
            overlayUrl: rotation.data?.categories?.NAME_OVERLAY?.today?.item?.previewUrl,
            profile,
          }}
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-1">
        <Label htmlFor="hero-preview-low" className="text-muted-foreground text-sm font-normal">
          Düşük efekt modunda önizle
        </Label>
        <Switch id="hero-preview-low" checked={lowPreview} onCheckedChange={setLowPreview} />
      </div>
    </div>
  );
}

function HeroForm({ hero, canEdit }) {
  const queryClient = useQueryClient();
  const form = useForm({
    resolver: zodResolver(heroSchema),
    defaultValues: {
      displayName: hero.displayName,
      tagline: hero.tagline ?? '',
      location: hero.location ?? '',
      nameEffects: hero.nameEffects,
      gradientFrom: hero.gradientFrom ?? HERO_GRADIENT_DEFAULTS.from,
      gradientTo: hero.gradientTo ?? HERO_GRADIENT_DEFAULTS.to,
      profileMode: hero.profileMode,
      fixedProfileMediaId: hero.fixedProfileMediaId,
    },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const saved = await heroApi.update(values);
      queryClient.setQueryData(adminKeys.hero, saved);
      form.reset({ ...values, tagline: saved.tagline ?? '', location: saved.location ?? '' });
      toast.success('Hero kaydedildi.');
    } catch (error) {
      handleFormError(error, form.setError, [
        'displayName',
        'tagline',
        'location',
        'nameEffects',
        'gradientFrom',
        'gradientTo',
        'fixedProfileMediaId',
      ]);
    }
  });

  return (
    <form
      noValidate
      onSubmit={onSubmit}
      className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <SettingsCard
        title="İçerik"
        footer={
          canEdit && (
            <SubmitButton pending={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
              Kaydet
            </SubmitButton>
          )
        }
      >
        <fieldset disabled={!canEdit} className="grid gap-5">
          <FormField label="İsim" error={errors.displayName?.message}>
            <Input maxLength={60} {...form.register('displayName')} />
          </FormField>
          <FormField
            label="Slogan"
            error={errors.tagline?.message}
            description="Opsiyonel, en fazla 160 karakter."
          >
            <Input maxLength={160} {...form.register('tagline')} />
          </FormField>
          <FormField label="Konum" error={errors.location?.message}>
            <Input maxLength={80} placeholder="İstanbul" {...form.register('location')} />
          </FormField>

          <Controller
            control={form.control}
            name="nameEffects"
            render={({ field }) => (
              <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">İsim efektleri</legend>
                <div className="flex flex-wrap gap-2">
                  {NAME_EFFECTS.map((effect) => {
                    const active = field.value.includes(effect);
                    return (
                      <button
                        key={effect}
                        type="button"
                        aria-pressed={active}
                        onClick={() => field.onChange(toggleEffect(field.value, effect))}
                        className={cn(
                          'min-h-9 rounded-full border px-4 text-sm transition-colors',
                          active
                            ? 'border-transparent bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {EFFECT_LABELS[effect]}
                      </button>
                    );
                  })}
                </div>
                <p className="text-muted-foreground text-xs">
                  Birden fazla seçilebilir; iki gradyan birlikte seçilemez. İsim Efekti, Medya &gt;
                  İsim Efektleri sekmesinden yüklenen GIF&apos;lerden günün seçimini ismin üstünde
                  oynatır (düşük efekt modunda gizlenir). Hareketli gradyan her modda akar.
                </p>
                {errors.nameEffects?.message && (
                  <p className="text-danger text-xs font-medium">{errors.nameEffects.message}</p>
                )}
              </fieldset>
            )}
          />

          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">Gradyan renkleri</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <ColorField form={form} name="gradientFrom" label="Sol renk" />
              <ColorField form={form} name="gradientTo" label="Sağ renk" />
            </div>
            <p className="text-muted-foreground text-xs">
              Hareketli ve hareketsiz gradyan bu iki rengi kullanır.
            </p>
          </fieldset>

          <HeroProfileField form={form} canEdit={canEdit} />
        </fieldset>
      </SettingsCard>
      <div className="xl:sticky xl:top-24">
        <Preview control={form.control} />
      </div>
    </form>
  );
}

export function HeroPage() {
  const admin = useAuthStore((s) => s.admin);
  const hero = useQuery({ queryKey: adminKeys.hero, queryFn: heroApi.get });

  useEffect(() => {
    document.title = 'Hero Section · Yönetim';
  }, []);

  return (
    <>
      <PageHeader
        title="Hero Section"
        description="Ana sayfanın en üstündeki tanıtım: isim, slogan, konum, isim efektleri ve sitede yağan öğeler."
      />
      {hero.isPending && <Skeleton className="h-[480px] rounded-[var(--radius-lg)]" />}
      {hero.isError && <ErrorState onRetry={() => hero.refetch()} />}
      {hero.isSuccess && (
        <div className="grid gap-6">
          <HeroForm hero={hero.data} canEdit={hasPermission(admin, 'hero:write')} />
          <FallingItemsCard canEdit={hasPermission(admin, 'hero:write')} />
        </div>
      )}
    </>
  );
}
