// Hesap Ayarları: Profil · E-posta · Şifre · İki aşamalı doğrulama · Oturumlar · E-posta gönderimi.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { changeEmailSchema, newPasswordField, profileSchema } from '@my-portfolyo/shared';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { accountApi } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SettingsCard } from '../../components/SettingsCard.jsx';
import { MailTab } from './MailTab.jsx';
import { SessionsTab } from './SessionsTab.jsx';
import { TwoFactorTab } from './TwoFactorTab.jsx';

const TABS = [
  { value: 'profile', label: 'Profil' },
  { value: 'email', label: 'E-posta' },
  { value: 'password', label: 'Şifre' },
  { value: '2fa', label: 'İki aşamalı doğrulama' },
  { value: 'sessions', label: 'Oturumlar' },
  { value: 'mail', label: 'E-posta gönderimi' },
];

function ProfileTab() {
  const admin = useAuthStore((s) => s.admin);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName: admin?.displayName ?? '' },
  });

  const onSubmit = async (values) => {
    try {
      const updated = await accountApi.updateProfile(values);
      setAdmin(updated);
      reset({ displayName: updated.displayName ?? '' });
      toast.success('Profil kaydedildi.');
    } catch (error) {
      handleFormError(error, setError, ['displayName']);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <SettingsCard
        title="Profil"
        description="Panelde ve e-postalarda görünen adın."
        footer={
          <SubmitButton pending={isSubmitting} disabled={!isDirty}>
            Kaydet
          </SubmitButton>
        }
      >
        <div className="grid max-w-md gap-5">
          <FormField label="Görünen ad" error={errors.displayName?.message}>
            <Input autoComplete="name" {...register('displayName')} />
          </FormField>
        </div>
      </SettingsCard>
    </form>
  );
}

function EmailTab() {
  const admin = useAuthStore((s) => s.admin);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(changeEmailSchema),
    defaultValues: { newEmail: '', currentPassword: '' },
  });

  const onSubmit = async (values) => {
    try {
      setAdmin(await accountApi.changeEmail(values));
      reset();
      toast.success('E-posta adresin güncellendi.');
    } catch (error) {
      handleFormError(error, setError, ['newEmail', 'currentPassword']);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <SettingsCard
        title="E-posta adresi"
        description={
          <>
            Şu anki adresin <span className="text-foreground font-medium">{admin?.email}</span>.
            Girişte ve şifre sıfırlamada bu adres kullanılır.
          </>
        }
        footer={<SubmitButton pending={isSubmitting}>E-postayı değiştir</SubmitButton>}
      >
        <div className="grid max-w-md gap-5">
          <FormField label="Yeni e-posta" error={errors.newEmail?.message}>
            <Input type="email" autoComplete="email" {...register('newEmail')} />
          </FormField>
          <FormField label="Mevcut şifre" error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
        </div>
      </SettingsCard>
    </form>
  );
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifre zorunlu.'),
    newPassword: newPasswordField(),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirm'],
  });

function PasswordTab() {
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      setAdmin(await accountApi.changePassword({ currentPassword, newPassword }));
      reset();
      toast.success('Şifren güncellendi. Diğer cihazlardaki oturumlar kapatıldı.');
    } catch (error) {
      handleFormError(error, setError, ['currentPassword', 'newPassword']);
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
      <SettingsCard
        title="Şifre"
        description="Şifreni değiştirdiğinde bu cihaz dışındaki tüm oturumlar kapatılır."
        footer={<SubmitButton pending={isSubmitting}>Şifreyi değiştir</SubmitButton>}
      >
        <div className="grid max-w-md gap-5">
          <FormField label="Mevcut şifre" error={errors.currentPassword?.message}>
            <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField
            label="Yeni şifre"
            error={errors.newPassword?.message}
            description="En az 12 karakter. Birkaç kelimeden oluşan uzun bir ifade önerilir."
          >
            <PasswordInput autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <FormField label="Yeni şifre (tekrar)" error={errors.confirm?.message}>
            <PasswordInput autoComplete="new-password" {...register('confirm')} />
          </FormField>
        </div>
      </SettingsCard>
    </form>
  );
}

export function AccountPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'profile';

  return (
    <>
      <PageHeader
        title="Hesap Ayarları"
        description="Profilin, giriş bilgilerin, iki aşamalı doğrulama ve açık oturumların."
      />
      <Tabs
        value={tab}
        onValueChange={(value) => setParams({ tab: value }, { replace: true })}
        className="gap-6"
      >
        <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 py-0.5 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="max-w-3xl">
          <TabsContent value="profile">
            <ProfileTab />
          </TabsContent>
          <TabsContent value="email">
            <EmailTab />
          </TabsContent>
          <TabsContent value="password">
            <PasswordTab />
          </TabsContent>
          <TabsContent value="2fa">
            <TwoFactorTab />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsTab />
          </TabsContent>
          <TabsContent value="mail">
            <MailTab />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
