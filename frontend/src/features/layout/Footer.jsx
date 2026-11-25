// footer: teknolojiler + "© [güncel yıl] [Hero ismi]". Yıl otomatik.
// "Çerez tercihleri" her zaman burada. Teknoloji ikonları (Tech Stack) ile.
import { Link } from 'react-router';
import { useConsent } from '@/features/consent/consentStore.js';
import { useSite } from '@/features/site/useSite.js';
import { Reveal } from '@/features/motion/Reveal.jsx';
import { TechIcon } from './TechIcon.jsx';

export function Footer() {
  const { data } = useSite();
  const techs = data?.footer?.techs ?? [];
  const owner = data?.footer?.ownerName ?? data?.navbarTitle ?? 'my-portfolyo';
  const openPreferences = useConsent((s) => s.openPreferences);
  return (
    <footer className="mx-auto w-full max-w-[1200px] px-4 pt-16 pb-10 sm:px-6">
      {/* Arka plan ne olursa olsun okunur: cam kutu (2026-11-16). */}
      <Reveal className="surface-chrome text-muted-foreground flex flex-col items-center gap-3 rounded-[var(--radius-xl)] border px-5 py-6 text-center text-sm">
        {techs.length > 0 && (
          <ul
            aria-label="Kullanılan teknolojiler"
            className="type-meta flex flex-wrap justify-center gap-x-4 gap-y-1"
          >
            {techs.map((t, i) => (
              <li key={`${t.label}-${i}`} className="inline-flex items-center gap-1.5">
                {t.icon && <TechIcon name={t.icon} className="size-4" />}
                {t.label}
              </li>
            ))}
          </ul>
        )}
        <p>
          © {new Date().getFullYear()} {owner}
        </p>
        <nav aria-label="Yasal" className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          <Link to="/kvkk" className="hover:text-foreground underline-offset-4 hover:underline">
            KVKK aydınlatma metni
          </Link>
          <Link
            to="/cerez-politikasi"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Çerez politikası
          </Link>
          <button
            type="button"
            onClick={openPreferences}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Çerez tercihleri
          </button>
        </nav>
      </Reveal>
    </footer>
  );
}
