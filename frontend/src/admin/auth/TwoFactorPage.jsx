// FR-AUTH-02 — ikinci adım: TOTP veya kurtarma kodu. mfaToken yalnızca bellekte (router state).
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { startSession } from '@/lib/auth/session.js';
import { authApi } from '../lib/adminApi.js';
import { errorCode } from '../lib/forms.js';
import { safeNextPath } from '../lib/navigation.js';
import { AuthLayout, FormAlert } from '../components/AuthLayout.jsx';

const schemas = {
  code: z.object({
    value: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Uygulamadaki 6 haneli kodu gir.'),
  }),
  recovery: z.object({
    value: z.string().trim().min(8, 'Kurtarma kodu geçersiz.').max(32, 'Kurtarma kodu geçersiz.'),
  }),
};

export function TwoFactorPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [mode, setMode] = useState('code');
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schemas[mode]), defaultValues: { value: '' } });

  if (!state?.mfaToken) return <Navigate to="/admin/login" replace />;

  const onSubmit = async ({ value }) => {
    setFormError(null);
    try {
      const result = await authApi.verifySecondFactor({
        mfaToken: state.mfaToken,
        ...(mode === 'code' ? { code: value } : { recoveryCode: value }),
      });
      startSession(result);
      navigate(
        result.admin.mustChangePassword ? '/admin/change-password' : safeNextPath(state.next),
        { replace: true },
      );
    } catch (error) {
      if (errorCode(error) === 'MFA_EXPIRED') {
        navigate('/admin/login', {
          replace: true,
          state: { notice: 'Doğrulama süresi doldu. Yeniden giriş yap.' },
        });
        return;
      }
      setFormError(getErrorMessage(error));
      reset({ value: '' });
    }
  };

  const switchMode = () => {
    setMode((current) => (current === 'code' ? 'recovery' : 'code'));
    setFormError(null);
    reset({ value: '' });
  };

  return (
    <AuthLayout
      eyebrow="İki aşamalı doğrulama"
      title="Kimliğini doğrula"
      description={
        mode === 'code'
          ? 'Authenticator uygulamandaki 6 haneli kodu gir.'
          : 'Kaydettiğin kurtarma kodlarından birini gir. Her kod yalnızca bir kez çalışır.'
      }
      footer={
        <Link
          to="/admin/login"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Farklı hesapla giriş yap
        </Link>
      }
    >
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        <FormField
          label={mode === 'code' ? 'Doğrulama kodu' : 'Kurtarma kodu'}
          error={errors.value?.message}
        >
          {mode === 'code' ? (
            <Input
              key="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="type-meta h-12 text-center text-xl tracking-[0.5em]"
              {...register('value')}
            />
          ) : (
            <Input
              key="recovery"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="abcde-fghjk"
              className="type-meta h-12 text-center text-base"
              {...register('value')}
            />
          )}
        </FormField>

        <FormAlert>{formError}</FormAlert>

        <SubmitButton
          size="lg"
          className="w-full"
          pending={isSubmitting}
          pendingLabel="Doğrulanıyor"
        >
          Doğrula
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={switchMode}>
          {mode === 'code' ? 'Kurtarma kodu kullan' : 'Doğrulama kodu kullan'}
        </Button>
      </form>
    </AuthLayout>
  );
}
