// sayfa açılışında sorumluluk uyarısı. Yalnızca "Anladım" kapatır; kabul sayfa bazlı
// sessionStorage'da tutulur. Uyarı kapanmadan grid render edilmez (useDisclaimer).
import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.jsx';

const keyOf = (kind) => `disclaimer:${kind}`;

const accepted = (kind) => {
  try {
    return sessionStorage.getItem(keyOf(kind)) === '1';
  } catch {
    return false;
  }
};

export function useDisclaimer(kind) {
  const [ok, setOk] = useState(() => accepted(kind));
  const accept = () => {
    try {
      sessionStorage.setItem(keyOf(kind), '1');
    } catch {
      // depolama kapalı: bu sayfa görünümü boyunca geçerli
    }
    setOk(true);
  };
  return [ok, accept];
}

export function DisclaimerDialog({ open, onAccept }) {
  const block = (event) => event.preventDefault();
  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={block}
        onPointerDownOutside={block}
        onInteractOutside={block}
        className="surface-chrome max-w-md"
      >
        <DialogHeader className="items-center text-center sm:text-center">
          <span className="bg-surface-2 text-primary mb-1 grid size-12 place-items-center rounded-full">
            <ShieldAlert aria-hidden="true" className="size-5" />
          </span>
          <DialogTitle>Sorumluluk uyarısı</DialogTitle>
          <DialogDescription>
            İndirdiğiniz içeriklerden sorumluluk kabul etmiyoruz.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button onClick={onAccept} className="min-w-32">
            Anladım
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
