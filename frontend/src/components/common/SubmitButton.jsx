// kaydetme durumu: buton içi gösterge + disabled. Metin değişir, genişlik sabit kalır.
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';

export function SubmitButton({ pending, pendingLabel, children, ...props }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending && <Loader2 aria-hidden="true" className="animate-spin" />}
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
