// çerez tercihleri diyaloğu (lazy). Zorunlu kategori kilitli; analitik anahtarı.
import { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { useConsent } from './consentStore.js';

export default function PreferencesDialog({ version }) {
  const decision = useConsent((s) => s.decision);
  const decide = useConsent((s) => s.decide);
  const close = useConsent((s) => s.closePreferences);
  const [analytics, setAnalytics] = useState(Boolean(decision?.analytics));

  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Çerez tercihleri</DialogTitle>
          <DialogDescription>
            Tercihini istediğin zaman sayfanın altındaki “Çerez tercihleri” bağlantısından
            değiştirebilirsin.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="consent-necessary">Zorunlu</Label>
              <p className="text-muted-foreground text-xs">
                Tema/görünüm tercihlerin ve yönetim girişi için gerekli. Kapatılamaz.
              </p>
            </div>
            <Switch id="consent-necessary" checked disabled />
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="consent-analytics">Analitik</Label>
              <p className="text-muted-foreground text-xs">
                Anonim ziyaret ve proje görüntüleme sayıları. Ham IP saklanmaz; ziyaretçi kimliği
                her gün sıfırlanır.
              </p>
            </div>
            <Switch id="consent-analytics" checked={analytics} onCheckedChange={setAnalytics} />
          </div>
          <Link
            to="/cerez-politikasi"
            onClick={close}
            className="text-sm underline underline-offset-4"
          >
            Çerez politikasını oku
          </Link>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            Vazgeç
          </Button>
          <Button onClick={() => decide(analytics, version)}>Kaydet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
