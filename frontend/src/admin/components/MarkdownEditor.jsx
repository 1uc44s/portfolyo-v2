// Markdown editörü: araç çubuğu + Yaz/Önizle. Önizleme public render ile aynı bileşen.
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Bold, Heading2, Heading3, Italic, Link2, List, Quote } from 'lucide-react';
import { SafeMarkdown } from '@/components/common/SafeMarkdown.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { Textarea } from '@/components/ui/textarea.jsx';
import { cn } from '@/lib/utils';

const ACTIONS = [
  { label: 'Kalın', icon: Bold, wrap: ['**', '**'], placeholder: 'kalın metin' },
  { label: 'İtalik', icon: Italic, wrap: ['_', '_'], placeholder: 'italik metin' },
  { label: 'Başlık 2', icon: Heading2, prefix: '## ', placeholder: 'Başlık' },
  { label: 'Başlık 3', icon: Heading3, prefix: '### ', placeholder: 'Alt başlık' },
  { label: 'Liste', icon: List, prefix: '- ', placeholder: 'Madde' },
  { label: 'Alıntı', icon: Quote, prefix: '> ', placeholder: 'Alıntı' },
  { label: 'Bağlantı', icon: Link2, wrap: ['[', '](https://)'], placeholder: 'bağlantı metni' },
];

/**
 * react-hook-form `Controller` ile kullanılır (value/onChange).
 * @param {{ value: string, onChange: (v: string) => void, maxLength?: number, className?: string }} props
 */
export const MarkdownEditor = forwardRef(function MarkdownEditor(
  { value, onChange, maxLength, className, ...aria },
  ref,
) {
  const textarea = useRef(null);
  useImperativeHandle(ref, () => textarea.current);

  const apply = (action) => {
    const el = textarea.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || action.placeholder;
    let insert;
    if (action.wrap) {
      insert = `${action.wrap[0]}${selected}${action.wrap[1]}`;
    } else {
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      insert = `${start !== lineStart ? '\n' : ''}${action.prefix}${selected}`;
    }
    onChange(value.slice(0, start) + insert + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + insert.length, start + insert.length);
    });
  };

  return (
    <Tabs defaultValue="write" className={cn('gap-0', className)}>
      <div className="bg-surface-2/60 flex flex-wrap items-center justify-between gap-2 rounded-t-[var(--radius-md)] border border-b-0 p-1.5">
        <div role="toolbar" aria-label="Biçimlendirme" className="flex flex-wrap gap-0.5">
          {ACTIONS.map((action) => (
            <Button
              key={action.label}
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={action.label}
              title={action.label}
              onClick={() => apply(action)}
            >
              <action.icon aria-hidden="true" />
            </Button>
          ))}
        </div>
        <TabsList className="h-8">
          <TabsTrigger value="write" className="text-xs">
            Yaz
          </TabsTrigger>
          <TabsTrigger value="preview" className="text-xs">
            Önizle
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="write" className="mt-0">
        <Textarea
          ref={textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={maxLength}
          rows={14}
          spellCheck
          className="type-meta min-h-[280px] resize-y rounded-t-none text-sm leading-relaxed"
          {...aria}
        />
      </TabsContent>
      <TabsContent value="preview" className="mt-0">
        <div className="bg-card min-h-[280px] rounded-b-[var(--radius-md)] border p-5">
          {value.trim() ? (
            <SafeMarkdown>{value}</SafeMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm">
              Önizlenecek içerik yok. Boş bırakırsan bölüm sitede gösterilmez.
            </p>
          )}
        </div>
      </TabsContent>
      {maxLength && (
        <p className="type-meta text-muted-foreground mt-2 text-right">
          {value.length.toLocaleString('tr-TR')} / {maxLength.toLocaleString('tr-TR')}
        </p>
      )}
    </Tabs>
  );
});
