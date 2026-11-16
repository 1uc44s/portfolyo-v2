// FR-AUTH-12 — 2FA kurulum sihirbazı (şifre → QR → kod → kurtarma kodları), kapatma, kod yenileme.
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Copy, Download, ShieldCheck, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { accountApi } from '../../lib/adminApi.js';
import { handleFormError } from '../../lib/forms.js';
import { SettingsCard } from '../../components/SettingsCard.jsx';

const passwordOnly = z.object({ currentPassword: z.string().min(1, 'Mevcut şifre zorunlu.') });
const codeOnly = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Uygulamadaki 6 haneli kodu gir.'),
});
const passwordAndCode = passwordOnly.extend(codeOnly.shape);

const codeInputProps = {
  inputMode: 'numeric',
  autoComplete: 'one-time-code',
  maxLength: 6,
  placeholder: '000000',
  className: 'type-meta tracking-[0.3em]',
};

function RecoveryCodes({ codes, onDone }) {
  const [saved, setSaved] = useState(false);
  const text = codes.join('\n');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Kodlar panoya kopyalandı.');
    } catch {
      toast.error('Kopyalanamadı. Kodları elle not al.');
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }));
    const link = Object.assign(document.createElement('a'), {
      href: url,
      download: 'vasquez-kurtarma-kodlari.txt',
    });
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="grid gap-5">
      <p className="text-muted-foreground text-sm">
        Telefonuna erişemezsen bu kodlarla giriş yapabilirsin. Her kod bir kez çalışır ve bu kodlar{' '}
        <strong className="text-foreground">bir daha gösterilmeyecek</strong>.
      </p>
      <ol className="bg-surface-2 grid grid-cols-2 gap-x-6 gap-y-2 rounded-[var(--radius-md)] border p-4">
        {codes.map((code) => (
          <li key={code} className="type-meta text-[0.9375rem]">
            {code}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          <Copy aria-hidden="true" />
          Kopyala
        </Button>
        <Button variant="outline" size="sm" onClick={download}>
          <Download aria-hidden="true" />
          .txt olarak indir
        </Button>
      </div>
      <div className="flex items-center gap-3">
        <Checkbox id="codes-saved" checked={saved} onCheckedChange={(v) => setSaved(v === true)} />
        <Label htmlFor="codes-saved" className="font-normal">
          Kodları güvenli bir yere kaydettim
        </Label>
      </div>
      <DialogFooter>
        <Button disabled={!saved} onClick={onDone}>
          Bitti
        </Button>
      </DialogFooter>
    </div>
  );
}

function SetupDialog({ open, onOpenChange }) {
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const admin = useAuthStore((s) => s.admin);
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);

  const passwordForm = useForm({
    resolver: zodResolver(passwordOnly),
    defaultValues: { currentPassword: '' },
  });
  const codeForm = useForm({ resolver: zodResolver(codeOnly), defaultValues: { code: '' } });

  const close = (next) => {
    if (!next) {
      setSetup(null);
      setCodes(null);
      passwordForm.reset();
      codeForm.reset();
    }
    onOpenChange(next);
  };

  const start = passwordForm.handleSubmit(async (values) => {
    try {
      setSetup(await accountApi.setupTwoFactor(values));
    } catch (error) {
      handleFormError(error, passwordForm.setError, ['currentPassword']);
    }
  });

  const enable = codeForm.handleSubmit(async (values) => {
    try {
      const result = await accountApi.enableTwoFactor(values);
      setAdmin({ ...admin, totpEnabled: true });
      setCodes(result.recoveryCodes);
    } catch (error) {
      handleFormError(error, codeForm.setError, ['code']);
    }
  });

  const step = codes ? 3 : setup ? 2 : 1;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <p className="type-eyebrow">Adım {step} / 3</p>
          <DialogTitle>
            {step === 1 && 'Şifreni doğrula'}
            {step === 2 && 'Uygulamayla eşleştir'}
            {step === 3 && 'Kurtarma kodlarını kaydet'}
          </DialogTitle>
          <DialogDescription>
            {step === 1 && 'Kuruluma başlamadan önce mevcut şifreni gir.'}
            {step === 2 &&
              'Google Authenticator, 1Password veya benzeri bir uygulamayla QR kodu okut, ardından üretilen kodu gir.'}
            {step === 3 && 'İki aşamalı doğrulama açıldı. Diğer cihazlardaki oturumlar kapatıldı.'}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <form noValidate onSubmit={start} className="grid gap-5">
            <FormField
              label="Mevcut şifre"
              error={passwordForm.formState.errors.currentPassword?.message}
            >
              <PasswordInput
                autoComplete="current-password"
                {...passwordForm.register('currentPassword')}
              />
            </FormField>
            <DialogFooter>
              <SubmitButton pending={passwordForm.formState.isSubmitting}>Devam</SubmitButton>
            </DialogFooter>
          </form>
        )}

        {step === 2 && (
          <form noValidate onSubmit={enable} className="grid gap-5">
            <div className="flex flex-col items-center gap-3">
              <img
                src={setup.qrDataUrl}
                alt="Authenticator uygulaması için QR kod"
                width={200}
                height={200}
                className="rounded-[var(--radius-md)] bg-white p-2"
              />
              <details className="w-full text-sm">
                <summary className="text-muted-foreground hover:text-foreground cursor-pointer">
                  QR okutamıyor musun? Anahtarı elle gir
                </summary>
                <code className="type-meta bg-surface-2 mt-2 block rounded-[var(--radius-sm)] p-3 break-all select-all">
                  {setup.secret}
                </code>
              </details>
            </div>
            <FormField label="Doğrulama kodu" error={codeForm.formState.errors.code?.message}>
              <Input {...codeInputProps} {...codeForm.register('code')} />
            </FormField>
            <DialogFooter>
              <SubmitButton pending={codeForm.formState.isSubmitting}>Doğrula ve aç</SubmitButton>
            </DialogFooter>
          </form>
        )}

        {step === 3 && <RecoveryCodes codes={codes} onDone={() => close(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function SecondFactorDialog({ open, onOpenChange, mode }) {
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const admin = useAuthStore((s) => s.admin);
  const [codes, setCodes] = useState(null);
  const form = useForm({
    resolver: zodResolver(passwordAndCode),
    defaultValues: { currentPassword: '', code: '' },
  });

  const close = (next) => {
    if (!next) {
      setCodes(null);
      form.reset();
    }
    onOpenChange(next);
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      if (mode === 'disable') {
        await accountApi.disableTwoFactor(values);
        setAdmin({ ...admin, totpEnabled: false });
        toast.success('İki aşamalı doğrulama kapatıldı.');
        close(false);
      } else {
        setCodes((await accountApi.regenerateRecoveryCodes(values)).recoveryCodes);
      }
    } catch (error) {
      handleFormError(error, form.setError, ['currentPassword', 'code']);
    }
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'disable' ? 'İki aşamalı doğrulamayı kapat' : 'Kurtarma kodlarını yenile'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'disable'
              ? 'Hesabın yalnızca şifreyle korunacak. Onaylamak için şifreni ve uygulamadaki kodu gir.'
              : 'Eski kodların tümü geçersiz olur. Onaylamak için şifreni ve uygulamadaki kodu gir.'}
          </DialogDescription>
        </DialogHeader>
        {codes ? (
          <RecoveryCodes codes={codes} onDone={() => close(false)} />
        ) : (
          <form noValidate onSubmit={submit} className="grid gap-5">
            <FormField label="Mevcut şifre" error={form.formState.errors.currentPassword?.message}>
              <PasswordInput
                autoComplete="current-password"
                {...form.register('currentPassword')}
              />
            </FormField>
            <FormField label="Doğrulama kodu" error={form.formState.errors.code?.message}>
              <Input {...codeInputProps} {...form.register('code')} />
            </FormField>
            <DialogFooter>
              <SubmitButton
                variant={mode === 'disable' ? 'destructive' : 'default'}
                pending={form.formState.isSubmitting}
              >
                {mode === 'disable' ? 'Kapat' : 'Yeni kodlar üret'}
              </SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TwoFactorTab() {
  const enabled = useAuthStore((s) => s.admin?.totpEnabled);
  const [dialog, setDialog] = useState(null);
  const openState = (name) => ({
    open: dialog === name,
    onOpenChange: (next) => setDialog(next ? name : null),
  });

  return (
    <>
      <SettingsCard
        title="İki aşamalı doğrulama"
        description="Girişte şifrenin yanında telefonundaki authenticator uygulamasının ürettiği kod istenir."
        footer={
          enabled ? (
            <>
              <Button variant="outline" onClick={() => setDialog('regenerate')}>
                Kurtarma kodlarını yenile
              </Button>
              <Button variant="destructive" onClick={() => setDialog('disable')}>
                Kapat
              </Button>
            </>
          ) : (
            <Button onClick={() => setDialog('setup')}>Kurulumu başlat</Button>
          )
        }
      >
        <div className="flex items-center gap-3">
          {enabled ? (
            <ShieldCheck aria-hidden="true" className="text-success size-5" />
          ) : (
            <ShieldOff aria-hidden="true" className="text-warning size-5" />
          )}
          <span className="text-sm">Durum:</span>
          <Badge variant={enabled ? 'secondary' : 'outline'}>{enabled ? 'Açık' : 'Kapalı'}</Badge>
        </div>
      </SettingsCard>
      <SetupDialog {...openState('setup')} />
      <SecondFactorDialog mode="disable" {...openState('disable')} />
      <SecondFactorDialog mode="regenerate" {...openState('regenerate')} />
    </>
  );
}
