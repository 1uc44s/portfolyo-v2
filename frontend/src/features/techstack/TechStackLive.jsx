// yayındaki Tech Stack bölümleri (lazy chunk: halka bileşeni, serif font ve Popover ana
// pakete girmez). Her bölüm ("My Tech Stack", "My Security Skill"…) admin'deki sırayla ayrı bir halka.
import { useQuery } from '@tanstack/react-query';
import { fetchTechStack } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { TechStackRing } from './TechStackRing.jsx';

const groupName = (title) => [title.top, title.main, title.bottom].filter(Boolean).join(' ');

export default function TechStackLive() {
  const query = useQuery({ queryKey: queryKeys.techStack, queryFn: fetchTechStack });
  const data = query.data;
  const groups = data?.groups ?? [];
  if (query.isError || (data && (!data.published || groups.length === 0))) return null;

  if (!data) {
    return (
      <section
        id="tech-stack"
        aria-label="Tech Stack"
        className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-12 sm:px-6"
      >
        <div
          aria-hidden="true"
          className="mx-auto w-full max-w-[976px] animate-pulse rounded-full bg-muted/40"
          style={{ aspectRatio: '976 / 1092' }}
        />
      </section>
    );
  }

  return groups.map((group, i) => (
    <section
      key={group.id}
      // İlk bölüm mevcut "#tech-stack" bağlantısını korur; diğerleri kendi id'siyle.
      id={i === 0 ? 'tech-stack' : `tech-stack-${group.id}`}
      aria-label={groupName(group.title) || 'Tech Stack'}
      className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-12 sm:px-6"
    >
      <TechStackRing title={group.title} items={group.items} />
    </section>
  ));
}
