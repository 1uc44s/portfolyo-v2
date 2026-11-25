// hero profil görseli: günlük rotasyon ya da sabit profil fotoğrafı.
// Seçenekler aktif + hazır profil medyası (`GET /hero/profile-options`, hero:read yeterli);
// önizlemeler public /media URL'leriyle gelir (aktif içerik public görünür).
import { useQuery } from '@tanstack/react-query';
import { Controller, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { cn } from '@/lib/utils';
import { adminKeys, heroApi } from '../lib/adminApi.js';

export function useProfileOptions() {
  return useQuery({ queryKey: adminKeys.heroProfileOptions, queryFn: heroApi.profileOptions });
}

function OptionGrid({ options, field, disabled }) {
  return (
    <div
      role="radiogroup"
      aria-label="Sabit profil görseli"
      className="grid grid-cols-3 gap-2 sm:grid-cols-4"
    >
      {options.map((option) => {
        const id = `profile-option-${option.id}`;
        const checked = field.value === option.id;
        return (
          <label
            key={option.id}
            htmlFor={id}
            className={cn(
              'focus-within:ring-ring/50 relative grid cursor-pointer gap-1 rounded-[var(--radius-md)] border p-1.5 text-xs focus-within:ring-[3px]',
              checked && 'border-primary bg-primary/5',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              id={id}
              name="fixedProfileMediaId"
              className="sr-only"
              checked={checked}
              disabled={disabled}
              onChange={() => field.onChange(option.id)}
            />
            <img
              src={option.thumbUrl}
              alt=""
              className="aspect-square w-full rounded-[var(--radius-sm)] object-cover"
            />
            <span className="truncate">{option.title}</span>
          </label>
        );
      })}
    </div>
  );
}

/** @param {{ form: import('react-hook-form').UseFormReturn, canEdit: boolean }} props */
export function HeroProfileField({ form, canEdit }) {
  const options = useProfileOptions();
  const mode = useWatch({ control: form.control, name: 'profileMode' });
  const hasOptions = (options.data?.length ?? 0) > 0;
  const error = form.formState.errors.fixedProfileMediaId?.message;

  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">Profil görseli</legend>
      <div className="flex items-center gap-3">
        <input
          type="radio"
          id="profile-rotation"
          value="ROTATION"
          className="size-4 accent-[var(--accent)]"
          {...form.register('profileMode')}
        />
        <Label htmlFor="profile-rotation" className="font-normal">
          Günlük rotasyon (her gün farklı profil fotoğrafı)
        </Label>
      </div>
      <div className={cn('flex items-center gap-3', !hasOptions && 'opacity-60')}>
        <input
          type="radio"
          id="profile-fixed"
          value="FIXED"
          disabled={!hasOptions && mode !== 'FIXED'}
          className="size-4 accent-[var(--accent)]"
          {...form.register('profileMode')}
        />
        <Label htmlFor="profile-fixed" className="font-normal">
          Sabit görsel
        </Label>
      </div>
      {options.isPending && <Skeleton className="h-24 rounded-[var(--radius-md)]" />}
      {options.isSuccess && !hasOptions && (
        <p className="text-muted-foreground text-xs">
          Sabit seçim için aktif bir profil fotoğrafı gerekli.{' '}
          <Link to="/admin/media/pfps" className="text-primary underline-offset-4 hover:underline">
            Profil fotoğrafı ekle
          </Link>
        </p>
      )}
      {mode === 'FIXED' && hasOptions && (
        <Controller
          control={form.control}
          name="fixedProfileMediaId"
          render={({ field }) => (
            <OptionGrid options={options.data} field={field} disabled={!canEdit} />
          )}
        />
      )}
      {error && (
        <p className="text-danger text-xs font-medium" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
