// `Hoşgeldiniz...` girişi: e-posta, şifre, beni 7 gün hatırla, şifremi unuttum.
import { useCallback, useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { loginSchema } from '@my-portfolyo/shared';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { CaptchaField } from '@/features/contact/TurnstileWidget.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { startSession } from '@/lib/auth/session.js';
import { authApi } from '../lib/adminApi.js';
import { safeNextPath } from '../lib/navigation.js';
import { AuthLayout, FormAlert } from '../components/AuthLayout.jsx';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const notice = location.state?.notice ?? null;
  const [formError, setFormError] = useState(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaErrorId = useId();
  const captcha = useQuery({
    queryKey: ['admin', 'auth', 'captcha'],
    queryFn: authApi.captcha,
    staleTime: Infinity,
    retry: 1,
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false, turnstileToken: '' },
  });

  const onToken = useCallback(
    (token) => setValue('turnstileToken', token ?? '', { shouldValidate: Boolean(token) }),
    [setValue],
  );

  const onSubmit = async (values) => {
    setFormError(null);
    try {
      const result = await authApi.login(values);
      if (result.mfaRequired) {
        navigate('/admin/login/2fa', { state: { mfaToken: result.mfaToken, next } });
        return;
      }
      startSession(result);
      navigate(result.admin.mustChangePassword ? '/admin/change-password' : next, {
        replace: true,
      });
    } catch (error) {
      setFormError(getErrorMessage(error));
      // Turnstile token'ı tek kullanımlık: her başarısız denemeden sonra yeni doğrulama gerekir.
      setCaptchaReset((n) => n + 1);
    }
  };

  return (
    <AuthLayout
      title="Hoşgeldiniz..."
      description="Yönetim paneline giriş yap."
      footer={<span className="type-meta">Bu alan yalnızca site yöneticileri içindir.</span>}
    >
      {notice && !formError && (
        <p
          role="status"
          className="bg-primary-soft mb-5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm"
        >
          {notice}
        </p>
      )}
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <FormField label="E-posta" error={errors.email?.message}>
          <Input type="email" autoComplete="username" inputMode="email" {...register('email')} />
        </FormField>

        <FormField
          label="Şifre"
          error={errors.password?.message}
          labelAction={
            <Link
              to="/admin/forgot-password"
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Şifremi unuttum
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...register('password')} />
        </FormField>

        <Controller
          control={control}
          name="rememberMe"
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Checkbox
                id="rememberMe"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
              />
              <Label htmlFor="rememberMe" className="font-normal">
                Beni 7 gün hatırla
              </Label>
            </div>
          )}
        />

        <CaptchaField
          siteKey={captcha.data?.siteKey}
          loading={captcha.isPending}
          failed={captcha.isError}
          onRetry={() => captcha.refetch()}
          onToken={onToken}
          resetKey={captchaReset}
          error={errors.turnstileToken?.message}
          errorId={captchaErrorId}
        />

        <FormAlert>{formError}</FormAlert>

        <SubmitButton
          size="lg"
          className="w-full"
          pending={isSubmitting}
          pendingLabel="Giriş yapılıyor"
        >
          Giriş yap
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}
