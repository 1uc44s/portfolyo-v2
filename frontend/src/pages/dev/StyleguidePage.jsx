// ROADMAP F4-07 — token'lar, tipografi, bileşenler ve durumlar; iki tema × iki yüzey × efekt.
// Yalnızca geliştirme build'inde yüklenir (routes.jsx).
import { Inbox } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { PasswordInput } from '@/components/common/PasswordInput.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Badge } from '@/components/ui/badge.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Checkbox } from '@/components/ui/checkbox.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Progress } from '@/components/ui/progress.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { TooltipProvider } from '@/components/ui/tooltip.jsx';
import { PrefsControls } from '@/admin/components/PrefsControls.jsx';

const SWATCHES = [
  ['--bg', 'Zemin'],
  ['--surface', 'Yüzey'],
  ['--surface-2', 'Yüzey 2'],
  ['--surface-3', 'Yüzey 3'],
  ['--text', 'Metin'],
  ['--text-muted', 'İkincil metin'],
  ['--accent', 'Vurgu (iris)'],
  ['--orchid', 'Orkide'],
  ['--success', 'Başarı'],
  ['--warning', 'Uyarı'],
  ['--danger', 'Hata'],
  ['--status-online', 'Çevrimiçi'],
  ['--status-idle', 'Boşta'],
  ['--status-dnd', 'Rahatsız etme'],
  ['--status-offline', 'Çevrimdışı'],
];

function Section({ title, children }) {
  return (
    <section className="space-y-4">
      <h2 className="type-eyebrow">{title}</h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  return (
    <TooltipProvider>
      <div className="scene-fallback min-h-dvh">
        <header className="surface-chrome sticky top-0 z-[var(--z-navbar)] flex h-16 items-center justify-between border-b px-6">
          <p className="font-display font-semibold">Stil rehberi</p>
          <PrefsControls />
        </header>
        <main className="mx-auto grid max-w-[1200px] gap-12 px-6 py-10">
          <Section title="Renk token'ları">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {SWATCHES.map(([token, label]) => (
                <div
                  key={token}
                  className="bg-card overflow-hidden rounded-[var(--radius-md)] border"
                >
                  <div className="h-14 border-b" style={{ background: `var(${token})` }} />
                  <div className="p-2.5">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="type-meta text-muted-foreground">{token}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Tipografi">
            <div className="surface-chrome space-y-4 rounded-[var(--radius-xl)] border p-6">
              <p className="type-hero">Vasquez</p>
              <p className="type-h1">Başlık 1 — Hoşgeldiniz...</p>
              <p className="type-h2">Bölüm başlığı — Projeler</p>
              <p className="type-h3">Kart başlığı — Discord durumu</p>
              <p className="max-w-[68ch]">
                Gövde metni. Ziyaretçi siteye girdiği an bir kişinin dijital odasına girdiğini
                hisseder; içerik sahnenin önünde yüzen cam panellerde durur. Türkçe karakterler:
                ğüşıöç ĞÜŞİÖÇ.
              </p>
              <p className="text-muted-foreground text-sm">İkincil metin, küçük.</p>
              <p className="type-meta">02:41 / 03:58 · 1.204 indirme</p>
              <p className="type-eyebrow">Üst başlık</p>
            </div>
          </Section>

          <Section title="Butonlar ve rozetler">
            <div className="flex flex-wrap items-center gap-3">
              <Button>Birincil</Button>
              <Button variant="secondary">İkincil</Button>
              <Button variant="outline">Çerçeveli</Button>
              <Button variant="ghost">Hayalet</Button>
              <Button variant="destructive">Sil</Button>
              <Button variant="link">Bağlantı</Button>
              <SubmitButton pending pendingLabel="Kaydediliyor">
                Kaydet
              </SubmitButton>
              <Badge>Varsayılan</Badge>
              <Badge variant="secondary">Yayında</Badge>
              <Badge variant="outline">Gizli</Badge>
              <Badge variant="destructive">Hata</Badge>
            </div>
          </Section>

          <Section title="Form">
            <div className="bg-card grid max-w-xl gap-5 rounded-[var(--radius-lg)] border p-6">
              <FormField label="E-posta" description="Girişte kullanılır.">
                <Input type="email" placeholder="ornek@alanadi.com" />
              </FormField>
              <FormField label="Şifre" error="Şifre en az 12 karakter olmalı.">
                <PasswordInput defaultValue="kisa" />
              </FormField>
              <div className="flex items-center gap-3">
                <Checkbox id="sg-check" defaultChecked />
                <Label htmlFor="sg-check" className="font-normal">
                  Beni 7 gün hatırla
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="sg-switch" defaultChecked />
                <Label htmlFor="sg-switch" className="font-normal">
                  Aktif
                </Label>
              </div>
              <div className="space-y-2">
                <p className="type-meta text-muted-foreground">Yükleniyor %62</p>
                <Progress value={62} aria-label="Yükleme ilerlemesi" />
              </div>
            </div>
          </Section>

          <Section title="Durumlar: yükleniyor · boş · hata">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="bg-card space-y-3 rounded-[var(--radius-lg)] border p-5">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-24 w-full" />
              </div>
              <EmptyState
                icon={Inbox}
                title="Henüz link yok"
                description="İlk linkini ekle; ana sayfada Linkler bölümü görünür olur."
                action={<Button size="sm">Link ekle</Button>}
              />
              <ErrorState onRetry={() => {}} />
            </div>
          </Section>
        </main>
      </div>
    </TooltipProvider>
  );
}
