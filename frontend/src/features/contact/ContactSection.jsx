// US-08, FR-CNT-01..06 — iletişim formu. Lazy chunk (react-hook-form + zod ana pakete girmez).
// Alan hataları istemci ve sunucuda aynı şemadan; sonuç aria-live ile duyurulur.
import { useCallback, useId, useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CONTACT_LIMITS, contactSchema } from '@vasquez/shared';
import { CheckCircle2, Send } from 'lucide-react';
import { FormField } from '@/components/common/FormField.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { sendContact } from '@/lib/api/publicApi.js';
import { CaptchaField } from './TurnstileWidget.jsx';

export const CONTACT_SUCCESS = 'Mesajın ulaştı. En kısa sürede dönüş yapacağım.';
const FIELDS = ['firstName', 'lastName', 'phone', 'email', 'subject', 'message', 'turnstileToken'];
const EMPTY = {
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  subject: '',
  message: '',
  turnstileToken: '',
  website: '',
};

/** Sunucu hatası → kullanıcı mesajı (alan hataları ayrıca forma yazılır). */
export function contactErrorMessage(error) {
  const status = error?.response?.status;
  if (!error?.response) return 'Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.';
  if (status === 429) {
    const seconds = Number(error.response.data?.error?.details?.retryAfter);
    const minutes = Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds / 60)) : null;
    return minutes
      ? `Kısa sürede çok fazla mesaj gönderdin. ${minutes} dakika sonra tekrar dene.`
      : 'Kısa sürede çok fazla mesaj gönderdin. Biraz sonra tekrar dene.';
  }
  if (status === 422) return 'Bazı alanlar hatalı. İşaretli alanları düzeltip tekrar gönder.';
  return getErrorMessage(error, 'Mesaj gönderilemedi. Biraz sonra tekrar dene.');
}

/**
 * @param {{ captcha?: { siteKey?: string }, captchaLoading?: boolean, captchaFailed?: boolean,
 *   onCaptchaRetry?: () => void }} props
 */
export default function ContactSection({
  captcha,
  captchaLoading = !captcha,
  captchaFailed = false,
  onCaptchaRetry,
}) {
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState(null);
  const [resetKey, setResetKey] = useState(0);
  const captchaErrorId = useId();
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: EMPTY,
    mode: 'onTouched',
  });
  const { errors, isSubmitting } = form.formState;
  const messageLength = form.watch('message')?.length ?? 0;

  const onToken = useCallback(
    (token) => {
      form.setValue('turnstileToken', token ?? '', { shouldValidate: Boolean(token) });
    },
    [form],
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setFailure(null);
    setSent(false);
    try {
      await sendContact(values);
      form.reset(EMPTY);
      setSent(true);
    } catch (error) {
      const details = error?.response?.data?.error?.details;
      if (Array.isArray(details)) {
        for (const d of details) {
          if (FIELDS.includes(d.path))
            form.setError(d.path, { type: 'server', message: d.message });
        }
      }
      setFailure(contactErrorMessage(error));
    } finally {
      // Token tek kullanımlık: her denemeden sonra yenisi gerekir.
      setResetKey((k) => k + 1);
    }
  });

  const field = (name) => form.register(name, { onChange: () => sent && setSent(false) });

  return (
    <section
      id="iletisim"
      aria-labelledby="contact-title"
      className="mx-auto w-full max-w-[880px] scroll-mt-24 px-4 py-16 sm:px-6"
    >
      <div className="mb-8 text-center">
        <h2 id="contact-title" className="type-h1">
          İletişim
        </h2>
        <p className="text-muted-foreground mt-2 text-pretty">
          Bir proje, iş birliği ya da sadece merhaba demek için yaz.
        </p>
      </div>
      <form
        noValidate
        onSubmit={onSubmit}
        aria-describedby="contact-kvkk"
        className="surface-chrome relative grid gap-5 rounded-[var(--radius-lg)] border p-5 sm:grid-cols-2 sm:p-8"
      >
        <FormField label="Ad" error={errors.firstName?.message}>
          <Input
            autoComplete="given-name"
            maxLength={CONTACT_LIMITS.firstName}
            {...field('firstName')}
          />
        </FormField>
        <FormField label="Soyad" error={errors.lastName?.message}>
          <Input
            autoComplete="family-name"
            maxLength={CONTACT_LIMITS.lastName}
            {...field('lastName')}
          />
        </FormField>
        <FormField label="Telefon (isteğe bağlı)" error={errors.phone?.message}>
          <Input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="0532 123 45 67"
            maxLength={20}
            {...field('phone')}
          />
        </FormField>
        <FormField label="E-posta" error={errors.email?.message}>
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            spellCheck={false}
            maxLength={254}
            {...field('email')}
          />
        </FormField>
        <FormField label="Konu" error={errors.subject?.message} className="sm:col-span-2">
          <Input maxLength={CONTACT_LIMITS.subject} {...field('subject')} />
        </FormField>
        <FormField
          label="Mesaj"
          error={errors.message?.message}
          className="sm:col-span-2"
          labelAction={
            <span className="text-muted-foreground text-xs tabular-nums" aria-hidden="true">
              {messageLength}/{CONTACT_LIMITS.message}
            </span>
          }
        >
          <Textarea
            rows={6}
            maxLength={CONTACT_LIMITS.message}
            className="min-h-36 resize-y"
            {...field('message')}
          />
        </FormField>

        {/* Honeypot: ekran okuyucu ve klavyeden gizli; yalnızca botlar doldurur. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label>
            Web siten
            <input type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
          </label>
        </div>

        <div className="flex flex-col gap-4 sm:col-span-2 sm:flex-row sm:items-end sm:justify-between">
          <CaptchaField
            siteKey={captcha?.siteKey}
            loading={captchaLoading && !captchaFailed}
            failed={captchaFailed}
            onRetry={onCaptchaRetry}
            onToken={onToken}
            resetKey={resetKey}
            error={errors.turnstileToken?.message}
            errorId={captchaErrorId}
          />
          <Button type="submit" size="lg" disabled={isSubmitting} className="sm:min-w-40">
            <Send aria-hidden="true" />
            {isSubmitting ? 'Gönderiliyor…' : 'Gönder'}
          </Button>
        </div>

        <div aria-live="polite" className="sm:col-span-2 empty:hidden">
          {sent && (
            <p className="bg-success/10 text-success flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              {CONTACT_SUCCESS}
            </p>
          )}
        </div>
        {failure && (
          <p
            role="alert"
            className="bg-danger/10 text-danger rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium sm:col-span-2"
          >
            {failure}
          </p>
        )}

        <p id="contact-kvkk" className="text-muted-foreground text-xs sm:col-span-2">
          Gönderdiğin bilgiler yalnızca sana dönüş yapmak için kullanılır ve 12 ay sonra silinir.
          Ayrıntılar için{' '}
          <Link to="/kvkk" className="text-foreground underline underline-offset-4">
            KVKK aydınlatma metni
          </Link>
          .
        </p>
      </form>
    </section>
  );
}
