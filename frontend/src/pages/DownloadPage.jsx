// FR-DL-01..09, US-07 — duvar kağıtları / profil fotoğrafları. Aktif içerik yoksa (navbar bayrağı
// false) uyarı gösterilmeden boş durum; varsa önce sorumluluk uyarısı, kabulden sonra galeri.
// Lazy chunk: Dialog ve galeri ana public paketine girmez.
import { useEffect } from 'react';
import { DisclaimerDialog, useDisclaimer } from '@/features/downloads/DisclaimerDialog.jsx';
import { DownloadGallery, EmptyDownloads } from '@/features/downloads/DownloadGallery.jsx';
import { useSite } from '@/features/site/useSite.js';
import { Reveal } from '@/features/motion/Reveal.jsx';

export const TITLES = {
  wallpapers: 'Duvar kağıtlarını beğendin mi? Ücretsiz alabilirsin.',
  pfps: 'Profil fotoğrafları',
};
const DOC_TITLES = { wallpapers: 'Duvar Kağıtları', pfps: 'Profil Fotoğrafları' };

function Page({ kind }) {
  const { data, isPending } = useSite();
  const available = data?.nav?.[kind];
  const [accepted, accept] = useDisclaimer(kind);

  useEffect(() => {
    const name = data?.navbarTitle;
    document.title = name ? `${DOC_TITLES[kind]} · ${name}` : DOC_TITLES[kind];
  }, [kind, data?.navbarTitle]);

  return (
    <Reveal as="section" className="mx-auto w-full max-w-[1200px] px-4 py-16 sm:px-6">
      <h1 className="type-h1 mb-8 text-center text-balance">{TITLES[kind]}</h1>
      {!isPending && !available && <EmptyDownloads />}
      {available && (
        <>
          <DisclaimerDialog open={!accepted} onAccept={accept} />
          {accepted && <DownloadGallery kind={kind} />}
        </>
      )}
    </Reveal>
  );
}

// `key`: /wallpapers ↔ /pfps geçişinde uyarı durumu sayfaya göre yeniden okunur.
export default function DownloadPage({ kind }) {
  return <Page key={kind} kind={kind} />;
}
