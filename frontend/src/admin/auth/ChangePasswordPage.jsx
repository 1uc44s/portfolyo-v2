// FR-AUTH-09 — geçici şifreyle açılan hesap paneli kullanmadan önce şifresini değiştirir.
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useNavigate } from 'react-router';
import { z } from 'zod';
import { newPasswordField } from '@vasquez/shared';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Button } from '@/components/ui/button.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { logout } from '@/lib/auth/session.js';
import { accountApi } from '../lib/adminApi.js';
import { handleFormError } from '../lib/forms.js';
import { AuthLayout } from '../components/AuthLayout.jsx';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Mevcut şifre zorunlu.'),
    newPassword: newPasswordField(),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirm'],
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Yeni şifre mevcut şifreyle aynı olamaz.',
    path: ['newPassword'],
  });

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const admin = useAuthStore((s) => s.admin);
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  if (status !== 'authenticated') return <Navigate to="/admin/login" replace />;

  const onSubmit = async ({ currentPassword, newPassword }) => {
    try {
      setAdmin(await accountApi.changePassword({ currentPassword, newPassword }));
      navigate('/admin', { replace: true });
    } catch (error) {
      handleFormError(error, setError, ['currentPassword', 'newPassword']);
    }
  };

  return (
    <AuthLayout
      eyebrow="Güvenlik"
      title="Şifreni değiştir"
      description={
        admin?.mustChangePassword
          ? 'Hesabın geçici bir şifreyle oluşturuldu. Devam etmeden önce kendi şifreni belirle.'
          : 'Yeni şifren en az 12 karakter olmalı.'
      }
      footer={
        <Button variant="link" className="text-muted-foreground" onClick={() => logout()}>
          Çıkış yap
        </Button>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <FormField label="Mevcut şifre" error={errors.currentPassword?.message}>
          <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
        </FormField>
        <FormField
          label="Yeni şifre"
          error={errors.newPassword?.message}
          description="Birkaç kelimeden oluşan uzun bir ifade, kısa ve karmaşık bir şifreden daha güçlüdür."
        >
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </FormField>
        <FormField label="Yeni şifre (tekrar)" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register('confirm')} />
        </FormField>
        <SubmitButton
          size="lg"
          className="w-full"
          pending={isSubmitting}
          pendingLabel="Kaydediliyor"
        >
          Şifreyi kaydet ve devam et
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
