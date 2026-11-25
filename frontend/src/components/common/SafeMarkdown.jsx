// Markdown güvenli render: ham HTML atılır, izinli öğe listesi, yalnızca
// http/https/mailto linkleri; harici linkler yeni sekmede noopener noreferrer.
import Markdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { cn } from '@/lib/utils';

const ALLOWED_ELEMENTS = [
  'p',
  'h2',
  'h3',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'code',
  'pre',
  'hr',
  'br',
];

const SAFE_PROTOCOL = /^(https?:|mailto:)/i;

/** İzinsiz protokollü link hedefini tamamen düşürür. */
export const safeUrl = (url) => (SAFE_PROTOCOL.test(String(url).trim()) ? url : '');

function Link({ href, children }) {
  if (!href) return <span>{children}</span>;
  const external = /^https?:/i.test(href);
  return (
    <a
      href={href}
      {...(external && { target: '_blank', rel: 'noopener noreferrer' })}
      className="text-primary underline underline-offset-4 hover:no-underline"
    >
      {children}
    </a>
  );
}

export function SafeMarkdown({ children, className }) {
  return (
    <div
      className={cn(
        'max-w-[68ch] space-y-4 leading-relaxed text-pretty',
        '[&_h2]:type-h2 [&_h2]:mt-8 [&_h3]:type-h3 [&_h3]:mt-6',
        '[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-6',
        '[&_blockquote]:text-muted-foreground [&_blockquote]:border-l-2 [&_blockquote]:border-[var(--accent)] [&_blockquote]:pl-4',
        '[&_code]:bg-surface-2 [&_code]:type-meta [&_code]:rounded [&_code]:px-1.5 [&_code]:py-0.5',
        '[&_pre]:bg-surface-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:p-4',
        '[&_hr]:border-border',
        className,
      )}
    >
      <Markdown
        skipHtml
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        urlTransform={safeUrl}
        rehypePlugins={[rehypeSanitize]}
        components={{ a: Link }}
      >
        {children ?? ''}
      </Markdown>
    </div>
  );
}
