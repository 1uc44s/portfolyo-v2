// her durumda aynı yanıt; hesabın var olup olmadığı söylenmez.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import { Link } from 'react-router';
import { forgotPasswordSchema } from '@my-portfolyo/shared';
import { FormField } from '@/components/common/FormField.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Input } from '@/components/ui/input.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { authApi } from '../lib/adminApi.js';
import { AuthLayout, FormAlert } from '../components/AuthLayout.jsx';

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      await authApi.forgotPassword(values);
      setSent(true);
    } catch (error) {
      setFormError(getErrorMessage(error));
    }
  };

  const backToLogin = (
    <Link to="/admin/login" className="hover:text-foreground underline-offset-4 hover:underline">
      Girişe dön
    </Link>
  );

  if (sent) {
    return (
      <AuthLayout eyebrow="Şifre sıfırlama" title="E-postanı kontrol et" footer={backToLogin}>
        <div role="status" className="flex gap-3">
          <MailCheck aria-hidden="true" className="text-primary mt-0.5 size-5 shrink-0" />
          <p className="text-muted-foreground text-sm leading-relaxed">
            Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi. Bağlantı 30 dakika geçerli ve
            yalnızca bir kez kullanılabilir. Gelen kutunda yoksa istenmeyen klasörüne bak.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Şifre sıfırlama"
      title="Şifreni mi unuttun?"
      description="Hesabına kayıtlı e-posta adresini yaz; sıfırlama bağlantısı gönderelim."
      footer={backToLogin}
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <FormField label="E-posta" error={errors.email?.message}>
          <Input type="email" autoComplete="username" inputMode="email" {...register('email')} />
        </FormField>
        <FormAlert>{formError}</FormAlert>
        <SubmitButton
          size="lg"
          className="w-full"
          pending={isSubmitting}
          pendingLabel="Gönderiliyor"
        >
          Sıfırlama bağlantısı gönder
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
