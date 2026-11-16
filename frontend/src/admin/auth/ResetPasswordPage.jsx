// FR-AUTH-11 — token URL fragment'ından (#token=) okunur; sunucuya ve Referer'a düşmez.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { newPasswordField } from '@vasquez/shared';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { buttonVariants } from '@/components/ui/button.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { authApi } from '../lib/adminApi.js';
import { handleFormError } from '../lib/forms.js';
import { AuthLayout, FormAlert } from '../components/AuthLayout.jsx';

const schema = z
  .object({ newPassword: newPasswordField(), confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'Şifreler eşleşmiyor.',
    path: ['confirm'],
  });

const readToken = () => new URLSearchParams(window.location.hash.slice(1)).get('token');

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [token] = useState(readToken);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { newPassword: '', confirm: '' } });

  if (!token) {
    return (
      <AuthLayout
        eyebrow="Şifre sıfırlama"
        title="Bağlantı geçersiz"
        description="Bu bağlantı eksik ya da bozuk. Yeni bir sıfırlama bağlantısı iste."
      >
        <Link to="/admin/forgot-password" className={buttonVariants({ className: 'w-full' })}>
          Yeni bağlantı iste
        </Link>
      </AuthLayout>
    );
  }

  const onSubmit = async ({ newPassword }) => {
    setFormError(null);
    try {
      await authApi.resetPassword({ token, newPassword });
      // Token'ı adres çubuğundan ve geçmişten temizle.
      window.history.replaceState(null, '', window.location.pathname);
      navigate('/admin/login', {
        replace: true,
        state: { notice: 'Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.' },
      });
    } catch (error) {
      if (error?.response?.status === 422) handleFormError(error, setError, ['newPassword']);
      else setFormError(getErrorMessage(error));
    }
  };

  return (
    <AuthLayout
      eyebrow="Şifre sıfırlama"
      title="Yeni şifre belirle"
      description="En az 12 karakter. Kolay tahmin edilmeyen, sana özel bir ifade seç."
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <FormField label="Yeni şifre" error={errors.newPassword?.message}>
          <PasswordInput autoComplete="new-password" {...register('newPassword')} />
        </FormField>
        <FormField label="Yeni şifre (tekrar)" error={errors.confirm?.message}>
          <PasswordInput autoComplete="new-password" {...register('confirm')} />
        </FormField>
        <FormAlert>{formError}</FormAlert>
        <SubmitButton
          size="lg"
          className="w-full"
          pending={isSubmitting}
          pendingLabel="Kaydediliyor"
        >
          Şifreyi güncelle
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
