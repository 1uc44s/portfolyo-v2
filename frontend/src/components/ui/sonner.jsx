// shadcn sonner — tema next-themes yerine kendi tercih store'umuzdan gelir.
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner } from 'sonner';
import { usePrefs } from '@/lib/prefs.js';

const Toaster = ({ ...props }) => {
  const theme = usePrefs((s) => s.theme);

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-success" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-warning" />,
        error: <OctagonXIcon className="size-4 text-danger" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        '--normal-bg': 'var(--surface)',
        '--normal-text': 'var(--text)',
        '--normal-border': 'var(--border-strong)',
        '--border-radius': 'var(--radius-md)',
        zIndex: 'var(--z-toast)',
      }}
      {...props}
    />
  );
};

export { Toaster };
