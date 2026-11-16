// Footer teknoloji ikonu — react-icons adından (ör. FaReact, SiVite). İlgili paket footer görününce lazy
// yüklenir (başlangıç paketini şişirmez); ad geçersiz/bulunamazsa sessizce boş döner.
import { useEffect, useState } from 'react';

// Paket öneki (REACT_ICON_PACKS) → react-icons alt yolu (önekin küçük harfi). Statik import: Vite bunları
// ayrı parçalara böler ve yalnızca kullanılan paket indirilir.
const LOADERS = {
  Ai: () => import('react-icons/ai'),
  Bi: () => import('react-icons/bi'),
  Bs: () => import('react-icons/bs'),
  Cg: () => import('react-icons/cg'),
  Ci: () => import('react-icons/ci'),
  Di: () => import('react-icons/di'),
  Fa: () => import('react-icons/fa'),
  Fa6: () => import('react-icons/fa6'),
  Fc: () => import('react-icons/fc'),
  Fi: () => import('react-icons/fi'),
  Gi: () => import('react-icons/gi'),
  Go: () => import('react-icons/go'),
  Gr: () => import('react-icons/gr'),
  Hi: () => import('react-icons/hi'),
  Hi2: () => import('react-icons/hi2'),
  Im: () => import('react-icons/im'),
  Io: () => import('react-icons/io'),
  Io5: () => import('react-icons/io5'),
  Lia: () => import('react-icons/lia'),
  Lu: () => import('react-icons/lu'),
  Md: () => import('react-icons/md'),
  Pi: () => import('react-icons/pi'),
  Ri: () => import('react-icons/ri'),
  Rx: () => import('react-icons/rx'),
  Si: () => import('react-icons/si'),
  Sl: () => import('react-icons/sl'),
  Tb: () => import('react-icons/tb'),
  Tfi: () => import('react-icons/tfi'),
  Ti: () => import('react-icons/ti'),
  Vsc: () => import('react-icons/vsc'),
  Wi: () => import('react-icons/wi'),
};

// En uzun öneki önce dener (Fa6 → Fa6, Hi2 → Hi2, değilse Fa / Hi).
const PREFIXES = Object.keys(LOADERS).sort((a, b) => b.length - a.length);
const prefixOf = (name) => PREFIXES.find((p) => name.startsWith(p)) ?? null;

export function TechIcon({ name, className }) {
  const [Icon, setIcon] = useState(null);
  useEffect(() => {
    setIcon(null);
    const loader = LOADERS[prefixOf(name ?? '')];
    if (!loader) return undefined;
    let alive = true;
    loader()
      .then((mod) => {
        if (alive) setIcon(() => mod[name] ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [name]);

  if (!Icon) return null;
  return <Icon aria-hidden="true" className={className} />;
}
