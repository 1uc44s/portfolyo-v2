// 2026-11-16 — her bileşen görünür alana girince animasyonla gelir (Framer Motion / motion).
// `Reveal`: tek blok (yukarı kayarak belirme; filtre yok — background-clip/SVG metinleri bozmasın). `Stagger` + `StaggerItem`: kart ızgaraları sırayla.
// Düşük efekt modu ya da prefers-reduced-motion'da (AppProviders MotionConfig) hareket yok, yalnızca
// opaklık; içerik hiçbir zaman gizli kalmaz (once: true, eşik %12).
import { m } from 'motion/react';

const EASE = [0.22, 1, 0.36, 1];
const VIEWPORT = { once: true, amount: 0.12, margin: '0px 0px -8% 0px' };

export const revealVariants = {
  hidden: { opacity: 0, y: 28 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: EASE } },
};

const TAGS = { div: m.div, section: m.section, ul: m.ul, ol: m.ol, li: m.li, article: m.article };

/** @param {{ as?: keyof TAGS, delay?: number } & Record<string, unknown>} props */
export function Reveal({ as = 'div', delay = 0, children, ...rest }) {
  const Tag = TAGS[as] ?? m.div;
  return (
    <Tag
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      variants={revealVariants}
      transition={delay ? { delay } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Kapsayıcı: çocuklarını 70 ms arayla getirir. */
export function Stagger({ as = 'div', gap = 0.07, children, ...rest }) {
  const Tag = TAGS[as] ?? m.div;
  return (
    <Tag
      initial="hidden"
      whileInView="shown"
      viewport={VIEWPORT}
      variants={{ hidden: {}, shown: { transition: { staggerChildren: gap } } }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export function StaggerItem({ as = 'div', children, ...rest }) {
  const Tag = TAGS[as] ?? m.div;
  return (
    <Tag variants={itemVariants} {...rest}>
      {children}
    </Tag>
  );
}

/** Sayfa geçişi: route değişince içerik yumuşakça gelir (key = pathname). */
export function PageTransition({ routeKey, children, className }) {
  return (
    <m.div
      key={routeKey}
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE }}
    >
      {children}
    </m.div>
  );
}
