// US-27 — SMTP ayarları (yalnızca Süper Admin düzenler); uygulama anahtarı asla geri gösterilmez.
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailWarning, Send } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { emailField } from '@vasquez/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { formatDateTime } from '@/lib/format.js';
import { accountApi, adminKeys } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';
import { SettingsCard } from '../../components/SettingsCard.jsx';

// Form katmanı: boş metin = null; port metinden sayıya.
const optionalText = z
  .string()
  .trim()
  .transform((v) => v || null);
const formSchema = z.object({
  smtpHost: optionalText,
  smtpPort: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && +v >= 1 && +v <= 65535), 'Geçerli bir port gir.')
    .transform((v) => (v ? Number(v) : null)),
  smtpSecure: z.boolean(),
  smtpUser: optionalText,
  appPassword: z.string(),
  fromName: optionalText,
  fromEmail: z.union([z.literal(''), emailField()]).transform((v) => v || null),
  notifyOnContact: z.boolean(),
  notifyEmail: z.union([z.literal(''), emailField()]).transform((v) => v || null),
});
const FIELDS = Object.keys(formSchema.shape);

const toForm = (s) => ({
  smtpHost: s.smtpHost ?? '',
  smtpPort: s.smtpPort ? String(s.smtpPort) : '',
  smtpSecure: s.smtpSecure,
  smtpUser: s.smtpUser ?? '',
  appPassword: '',
  fromName: s.fromName ?? '',
  fromEmail: s.fromEmail ?? '',
  notifyOnContact: s.notifyOnContact,
  notifyEmail: s.notifyEmail ?? '',
});

export function MailTab() {
  const queryClient = useQueryClient();
  const canEdit = useAuthStore((s) => s.admin?.role === 'SUPER_ADMIN');
  const mail = useQuery({ queryKey: adminKeys.mail, queryFn: accountApi.getMail });
  const [removeSecret, setRemoveSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  const form = useForm({ resolver: zodResolver(formSchema), defaultValues: toForm({}) });
  const { register, control, handleSubmit, reset, setError, formState } = form;
  const { errors, isSubmitting, isDirty } = formState;

  useEffect(() => {
    if (mail.data) reset(toForm(mail.data));
  }, [mail.data, reset]);

  if (mail.isPending) return <Skeleton className="h-[480px] rounded-[var(--radius-lg)]" />;
  if (mail.isError) return <ErrorState onRetry={() => mail.refetch()} />;

  const settings = mail.data;
  const secretSet = settings.appPassword.isSet && !removeSecret;

  const onSubmit = async ({ appPassword, ...values }) => {
    const body = { ...values };
    if (removeSecret) body.appPassword = null;
    else if (appPassword) body.appPassword = appPassword;
    try {
      const saved = await accountApi.updateMail(body);
      queryClient.setQueryData(adminKeys.mail, saved);
      setRemoveSecret(false);
      toast.success('E-posta ayarları kaydedildi.');
    } catch (error) {
      handleFormError(error, setError, FIELDS);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await accountApi.testMail();
      toast.success('Test e-postası gönderildi. Gelen kutunu kontrol et.');
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setTesting(false);
      queryClient.invalidateQueries({ queryKey: adminKeys.mail });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
      {!settings.configured && (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 flex gap-3 rounded-[var(--radius-md)] border p-4 text-sm"
        >
          <MailWarning aria-hidden="true" className="text-warning mt-0.5 size-5 shrink-0" />
          <p>
            <strong className="font-semibold">E-posta gönderimi ayarlanmadı.</strong> Şifremi
            unuttum e-postaları gönderilemez.
          </p>
        </div>
      )}

      <SettingsCard
        title="SMTP sunucusu"
        description={
          canEdit
            ? 'Gmail için uygulama şifresi kullan (smtp.gmail.com, port 465, SSL açık).'
            : 'Bu ayarları yalnızca Süper Admin değiştirebilir.'
        }
        footer={
          canEdit && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={sendTest}
                disabled={!settings.configured || isDirty || testing}
              >
                <Send aria-hidden="true" />
                {testing ? 'Gönderiliyor' : 'Test e-postası gönder'}
              </Button>
              <SubmitButton pending={isSubmitting} disabled={!isDirty && !removeSecret}>
                Kaydet
              </SubmitButton>
            </>
          )
        }
      >
        <fieldset disabled={!canEdit} className="grid gap-5 sm:grid-cols-2">
          <FormField label="Sunucu" error={errors.smtpHost?.message}>
            <Input placeholder="smtp.gmail.com" autoComplete="off" {...register('smtpHost')} />
          </FormField>
          <FormField label="Port" error={errors.smtpPort?.message}>
            <Input inputMode="numeric" placeholder="465" {...register('smtpPort')} />
          </FormField>
          <FormField label="Kullanıcı adı" error={errors.smtpUser?.message}>
            <Input autoComplete="off" {...register('smtpUser')} />
          </FormField>
          <FormField
            label="Uygulama şifresi"
            error={errors.appPassword?.message}
            description={
              secretSet
                ? 'Ayarlı. Değiştirmek için yenisini yaz; boş bırakırsan korunur.'
                : 'Şifrelenerek saklanır ve bir daha gösterilmez.'
            }
            labelAction={
              secretSet &&
              canEdit && (
                <button
                  type="button"
                  onClick={() => setRemoveSecret(true)}
                  className="text-danger text-xs font-medium underline-offset-4 hover:underline"
                >
                  Kaldır
                </button>
              )
            }
          >
            <PasswordInput
              autoComplete="new-password"
              placeholder={secretSet ? '••••••••••••' : ''}
              {...register('appPassword')}
            />
          </FormField>
          <FormField label="Gönderen adı" error={errors.fromName?.message}>
            <Input placeholder="vasquez" {...register('fromName')} />
          </FormField>
          <FormField label="Gönderen e-posta" error={errors.fromEmail?.message}>
            <Input type="email" placeholder="noreply@alanadi.com" {...register('fromEmail')} />
          </FormField>
          <Controller
            control={control}
            name="smtpSecure"
            render={({ field }) => (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Switch id="smtpSecure" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="smtpSecure" className="font-normal">
                  SSL/TLS ile bağlan (port 465)
                </Label>
              </div>
            )}
          />
        </fieldset>
        {removeSecret && (
          <p role="status" className="text-danger mt-4 text-sm">
            Uygulama şifresi kaydettiğinde silinecek.
          </p>
        )}
        {settings.lastTestAt && (
          <p className="type-meta text-muted-foreground mt-5">
            Son test: {formatDateTime(settings.lastTestAt)} ·{' '}
            {settings.lastTestOk ? 'başarılı' : 'başarısız'}
          </p>
        )}
      </SettingsCard>

      <SettingsCard
        title="Bildirimler"
        description="İletişim formundan yeni mesaj geldiğinde e-posta gönder (iletişim modülü F14'te gelecek)."
      >
        <fieldset disabled={!canEdit} className="grid gap-5">
          <Controller
            control={control}
            name="notifyOnContact"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch
                  id="notifyOnContact"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <Label htmlFor="notifyOnContact" className="font-normal">
                  Yeni mesajda e-posta gönder
                </Label>
              </div>
            )}
          />
          <FormField
            label="Bildirim adresi"
            error={errors.notifyEmail?.message}
            description="Boş bırakırsan hesabının e-posta adresine gider."
            className="max-w-md"
          >
            <Input type="email" {...register('notifyEmail')} />
          </FormField>
        </fieldset>
      </SettingsCard>
    </form>
  );
}
