// 404. Tam sayfa: menüsüz, kaydırmasız (tek ekran), TON 618 video arka planlı
// "dossier" tasarımı (kara delik solda, bilgi sütunu sağda; mobilde delik üstte, özet altta).
// Video her zaman hareketli başlar (kullanıcı isteği); WCAG 2.2.2 için duraklat düğmesi var.
// `embedded`: PublicLayout içinde (ör. /projects/:slug bulunamadı) — site kabuğu korunur.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Pause, Play } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button.jsx';
import { usePlayer } from '@/features/player/playerStore.js';

const SECTIONS = [
  {
    title: 'Nedir?',
    body: "Av Köpekleri takımyıldızı yönünde, evrenin en parlak kuasarlarından biri. Kara deliğe düşen gaz ısınıp Güneş'ten yaklaşık 100 trilyon kat parlak ışır.",
  },
  {
    title: 'Kütle',
    body: "Yaklaşık 40 milyar Güneş kütlesi (eski bir ölçüm 66 milyar). Samanyolu'nun merkezindeki Sagittarius A*'dan kabaca on bin kat ağır.",
  },
  {
    title: 'Olay ufku',
    body: "Yarıçapı ~800 astronomik birim: Güneş–Dünya uzaklığının 800 katı. Neptün'ün yörüngesi içinde kaybolur; ışık bile geri dönemez.",
  },
  {
    title: 'Uzaklık',
    body: 'Işığı bize ~10,8 milyar yılda ulaştı (z ≈ 2,22). Gördüğümüz, evren henüz 3 milyar yaşındayken yola çıkmış bir sinyal.',
  },
  {
    title: 'Keşif',
    body: "Adı Meksika'daki Tonantzintla Gözlemevi'nden gelir: 1957'de mavi yıldız kataloğuna 618. nesne olarak girdi, 1970'lerde kuasar olduğu anlaşıldı.",
  },
];

/** Dar ekran özeti (uzun paragraflar yerine). */
const FACTS = [
  ['Kütle', '~40 milyar M☉'],
  ['Olay ufku', '~800 AU'],
  ['Uzaklık', '~10,8 milyar ışık yılı'],
  ['Parlaklık', '~100 trilyon Güneş'],
];

// Ekran yüksekliğine göre ölçeklenen yazı: içerik her zaman tek ekrana sığar.
const BODY = 'text-[clamp(10.5px,1.55dvh,13px)] leading-[1.5]';
const LABEL = 'text-[clamp(9.5px,1.2dvh,11px)] tracking-[0.35em] uppercase';

/** Kara delik simgesi: olay ufku + eğik yığılma diski. */
function BlackHoleGlyph({ className }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className} fill="none">
      <circle
        cx="24"
        cy="24"
        r="8.5"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <ellipse
        cx="24"
        cy="24"
        rx="20"
        ry="6"
        transform="rotate(-18 24 24)"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.85"
      />
      <path
        d="M14.5 17.5a11.5 11.5 0 0 1 19 0"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
    </svg>
  );
}

function EmbeddedNotFound() {
  return (
    <section className="grid min-h-[60dvh] place-items-center px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="type-eyebrow">404</p>
        <h1 className="type-h1">Sayfa bulunamadı</h1>
        <p className="text-muted-foreground">
          Aradığın sayfa taşınmış ya da hiç var olmamış olabilir.
        </p>
        <Link to="/" className={buttonVariants({ size: 'lg', className: 'mt-2' })}>
          Ana sayfaya dön
        </Link>
      </div>
    </section>
  );
}

function Ton618NotFound() {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    document.title = '404 · Sayfa bulunamadı';
    // Oynatıcı arayüzü yok: çalan müzik varsa durdur (tercih kaydedilmez).
    const { audio, playing: musicPlaying } = usePlayer.getState();
    if (musicPlaying) audio?.pause();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      // Sessiz video her tarayıcıda otomatik oynar; reddedilirse düğme durumu düzelir.
      if (playing) video.play()?.catch?.(() => setPlaying(false));
      else video.pause();
    } catch {
      // Ortam medya oynatmayı desteklemiyor (ör. test ortamı).
    }
  }, [playing]);

  return (
    <main className="relative isolate h-dvh overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        aria-hidden="true"
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        poster="/ton-618-poster.webp"
        // Kara delik solda kalsın diye yatay ayna; dar ekranda delik ortalanır.
        className="pointer-events-none absolute inset-0 -z-20 size-full -scale-x-100 object-cover [object-position:72%_50%] lg:[object-position:50%_50%]"
      >
        <source src="/ton-618.mp4" type="video/mp4" media="(min-width: 2400px)" />
        <source src="/ton-618-1080.mp4" type="video/mp4" />
      </video>
      {/* Yalnızca metin alanının arkası koyulaşır (okunurluk); sayfanın tamamına örtü yok. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.94)_0%,rgba(0,0,0,0.8)_38%,rgba(0,0,0,0)_62%)] lg:bg-[linear-gradient(to_left,rgba(0,0,0,0.93)_0%,rgba(0,0,0,0.82)_40%,rgba(0,0,0,0)_66%)]"
      />

      <div className="grid h-full grid-rows-[auto_minmax(0,1fr)_auto] gap-[clamp(8px,2dvh,24px)] px-5 pt-[clamp(14px,4dvh,40px)] pb-[clamp(10px,2.5dvh,28px)] sm:px-10">
        <header className="text-center">
          <h1 className="text-[clamp(12px,1.9dvh,16px)] font-light tracking-[0.6em] text-white/90">
            <span aria-hidden="true">- 404 -</span>
            <span className="sr-only">Sayfa bulunamadı</span>
          </h1>
          <p className={`mt-2 text-balance text-white/60 ${LABEL}`}>Sinyal olay ufkunda kayboldu</p>
        </header>

        <div className="flex min-h-0 items-end justify-center lg:items-center lg:justify-end">
          <article
            aria-labelledby="ton-618-title"
            className="w-full max-w-[26rem] lg:mr-[3vw] xl:mr-[6vw]"
          >
            <div className="flex flex-col items-center text-center">
              <BlackHoleGlyph className="size-[clamp(26px,4.2dvh,40px)] text-white/90" />
              <h2
                id="ton-618-title"
                className="mt-[clamp(4px,1dvh,12px)] text-[clamp(14px,2.3dvh,18px)] font-light tracking-[0.45em] text-white"
              >
                TON 618
              </h2>
              <p className={`mt-1 text-white/60 ${LABEL}`}>Ultra kütleli kara delik</p>
              <span
                aria-hidden="true"
                className="mt-[clamp(6px,1.6dvh,16px)] h-px w-full bg-white/35"
              />
            </div>

            {/* Dar ekran: kısa açıklama + 2×2 özet. */}
            <div className="lg:hidden">
              <p className={`mt-3 text-center text-white/80 ${BODY}`}>
                Aradığın sayfa olay ufkunun ötesine düştü. TON 618, Av Köpekleri yönünde evrenin en
                parlak kuasarlarından biri.
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                {FACTS.map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-[var(--radius-sm)] border border-white/15 px-3 py-2 text-center"
                  >
                    <dt className={`text-white/55 ${LABEL}`}>{label}</dt>
                    <dd className={`mt-0.5 text-white/90 ${BODY}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Geniş ekran: dossier bölümleri. */}
            <div className="hidden lg:block">
              {SECTIONS.map((s) => (
                <section key={s.title} className="mt-[clamp(8px,1.9dvh,20px)]">
                  <h3 className={`text-center font-medium text-white/90 ${LABEL}`}>{s.title}</h3>
                  <p lang="tr" className={`mt-1.5 text-justify text-white/75 hyphens-auto ${BODY}`}>
                    {s.body}
                  </p>
                </section>
              ))}
            </div>
          </article>
        </div>

        <footer className="text-center">
          <Link
            to="/"
            className="inline-flex min-h-11 items-center px-4 text-xs tracking-[0.45em] text-white/80 uppercase transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            Ana sayfaya dön
          </Link>
        </footer>
      </div>

      <button
        type="button"
        aria-label="Arka plan videosunu duraklat"
        aria-pressed={!playing}
        onClick={() => setPlaying((p) => !p)}
        className="absolute right-4 bottom-4 grid size-10 place-items-center rounded-full border border-white/25 bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {playing ? (
          <Pause aria-hidden="true" className="size-4" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
      </button>
    </main>
  );
}

export function NotFoundPage({ embedded = false }) {
  return embedded ? <EmbeddedNotFound /> : <Ton618NotFound />;
}
