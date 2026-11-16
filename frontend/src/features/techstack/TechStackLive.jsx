// FR-PUB-04B — yayındaki Tech Stack (lazy chunk: halka bileşeni, serif font ve Popover ana pakete girmez).
import { useQuery } from '@tanstack/react-query';
import { fetchTechStack } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { TechStackRing } from './TechStackRing.jsx';

export default function TechStackLive() {
  const query = useQuery({ queryKey: queryKeys.techStack, queryFn: fetchTechStack });
  const data = query.data;
  if (query.isError || (data && (!data.published || data.items.length === 0))) return null;
  return (
    <section
      id="tech-stack"
      aria-label="Tech Stack"
      className="mx-auto w-full max-w-[1200px] scroll-mt-24 px-4 py-12 sm:px-6"
    >
      {data ? (
        <TechStackRing title={data.title} items={data.items} />
      ) : (
        <div
          aria-hidden="true"
          className="mx-auto w-full max-w-[976px] animate-pulse rounded-full bg-muted/40"
          style={{ aspectRatio: '976 / 1092' }}
        />
      )}
    </section>
  );
}
