// /kvkk ve /cerez-politikasi. Lazy chunk (SafeMarkdown).
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SafeMarkdown } from '@/components/common/SafeMarkdown.jsx';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { fetchLegal } from '@/lib/api/publicApi.js';
import { queryKeys } from '@/lib/api/queryKeys.js';
import { formatDateTime } from '@/lib/format.js';
import { Reveal } from '@/features/motion/Reveal.jsx';

export default function LegalPage({ docKey }) {
  const query = useQuery({ queryKey: queryKeys.legal(docKey), queryFn: () => fetchLegal(docKey) });
  const doc = query.data;

  useEffect(() => {
    if (doc?.title) document.title = doc.title;
  }, [doc?.title]);

  return (
    <Reveal as="article" className="mx-auto w-full max-w-[760px] px-4 py-16 sm:px-6">
      {query.isPending && (
        <div className="grid gap-4" aria-busy="true">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-64" />
        </div>
      )}
      {query.isError && <ErrorState onRetry={() => query.refetch()} />}
      {doc && (
        <>
          <h1 className="type-h1 mb-2 text-balance">{doc.title}</h1>
          <p className="type-meta text-muted-foreground mb-8">
            Son güncelleme: {formatDateTime(doc.updatedAt)} · Sürüm {doc.version}
          </p>
          <div className="surface-chrome rounded-[var(--radius-lg)] border p-6 sm:p-8">
            <SafeMarkdown>{doc.bodyMarkdown}</SafeMarkdown>
          </div>
        </>
      )}
    </Reveal>
  );
}
