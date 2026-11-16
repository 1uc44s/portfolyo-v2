// FR-ABT-01/02 — Hakkımda: başlık + güvenli Markdown. Gövde boşsa (site.about = null) render edilmez.
// Lazy chunk (react-markdown ~38 KB gzip ana public paketine girmez).
import { SafeMarkdown } from '@/components/common/SafeMarkdown.jsx';

export default function AboutSection({ about }) {
  if (!about?.bodyMarkdown?.trim()) return null;
  return (
    <section
      id="hakkimda"
      aria-labelledby="about-title"
      className="mx-auto w-full max-w-[760px] scroll-mt-24 px-4 py-16 sm:px-6"
    >
      <h2 id="about-title" className="type-h1 mb-6 text-center">
        {about.title || 'Hakkımda'}
      </h2>
      <div className="surface-chrome rounded-[var(--radius-lg)] border p-6 sm:p-8">
        <SafeMarkdown>{about.bodyMarkdown}</SafeMarkdown>
      </div>
    </section>
  );
}
