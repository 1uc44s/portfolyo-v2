// FR-THM — tema, yüzey ve efekt anahtarları (admin üst bar + giriş ekranı).
import { Layers, Moon, Sparkles, Square, Sun, Wind } from 'lucide-react';
import { Button } from '@/components/ui/button.jsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.jsx';
import { usePrefs } from '@/lib/prefs.js';

function ToggleButton({ label, pressed, onClick, children }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
          className="text-muted-foreground hover:text-foreground"
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export function PrefsControls({ showEffects = true }) {
  const { theme, surface, effects, toggleTheme, toggleSurface, toggleEffects } = usePrefs();
  return (
    <div className="flex items-center gap-0.5">
      <ToggleButton
        label={theme === 'dark' ? 'Açık temaya geç' : 'Koyu temaya geç'}
        pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        {theme === 'dark' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      </ToggleButton>
      <ToggleButton
        label={surface === 'glass' ? 'Klasik görünüme geç' : 'Cam görünüme geç'}
        pressed={surface === 'glass'}
        onClick={toggleSurface}
      >
        {surface === 'glass' ? <Layers aria-hidden="true" /> : <Square aria-hidden="true" />}
      </ToggleButton>
      {showEffects && (
        <ToggleButton
          label={effects === 'full' ? 'Düşük efekt moduna geç' : 'Tam efekt moduna geç'}
          pressed={effects === 'low'}
          onClick={toggleEffects}
        >
          {effects === 'full' ? <Sparkles aria-hidden="true" /> : <Wind aria-hidden="true" />}
        </ToggleButton>
      )}
    </div>
  );
}
