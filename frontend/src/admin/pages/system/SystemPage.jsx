// Sistem Ayarları: yasal metinler (KVKK aydınlatma, çerez politikası;
// "sürümü artır" → ziyaretçilere çerez bandı yeniden gösterilir).
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { hasPermission, LEGAL_BODY_MAX } from '@my-portfolyo/shared';
import { ErrorState } from '@/components/common/ErrorState.jsx';
import { FormField } from '@/components/common/FormField.jsx';
import { SubmitButton } from '@/components/common/SubmitButton.jsx';
import { Input } from '@/components/ui/input.jsx';
import { Label } from '@/components/ui/label.jsx';
import { Skeleton } from '@/components/ui/skeleton.jsx';
import { Switch } from '@/components/ui/switch.jsx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx';
import { getErrorMessage } from '@/lib/api/client.js';
import { useAuthStore } from '@/lib/auth/authStore.js';
import { formatDateTime } from '@/lib/format.js';
import { MarkdownEditor } from '../../components/MarkdownEditor.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import { SettingsCard } from '../../components/SettingsCard.jsx';
import { adminKeys, systemApi } from '../../lib/adminApi.js';

export const LEGAL_META = {
  'kvkk-notice': { label: 'KVKK aydınlatma metni', path: '/kvkk', bumpHint: null },
  'cookie-policy': {
    label: 'Çerez politikası',
    path: '/cerez-politikasi',
    bumpHint: 'Sürümü artırırsan tüm ziyaretçilere çerez bandı yeniden gösterilir.',
  },
};

export function LegalEditor({ doc, canEdit }) {
  const queryClient = useQueryClient();
  const meta = LEGAL_META[doc.slug];
  const [title, setTitle] = useState(doc.title);
  const [body, setBody] = useState(doc.bodyMarkdown);
  const [bump, setBump] = useState(false);
  const [errors, setErrors] = useState({});

  const save = useMutation({
    mutationFn: () =>
      systemApi.saveLegal(doc.slug, { title, bodyMarkdown: body, bumpVersion: bump }),
    onSuccess: (saved) => {
      setErrors({});
      setBump(false);
      toast.success(bump ? `Kaydedildi · sürüm ${saved.version}` : 'Kaydedildi.');
      queryClient.invalidateQueries({ queryKey: adminKeys.legal });
    },
    onError: (error) => {
      const details = error?.response?.data?.error?.details;
      if (Array.isArray(details) && details.length) {
        setErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
      } else toast.error(getErrorMessage(error));
    },
  });

  const dirty = title !== doc.title || body !== doc.bodyMarkdown || bump;
  const switchId = `bump-${doc.slug}`;

  return (
    <SettingsCard
      title={meta.label}
      description={`Sürüm ${doc.version} · son güncelleme ${formatDateTime(doc.updatedAt)}`}
      footer={
        <>
          <a
            href={meta.path}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground mr-auto inline-flex items-center gap-1 text-sm hover:underline"
          >
            Sayfayı aç
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
          <SubmitButton
            type="button"
            pending={save.isPending}
            disabled={!canEdit || !dirty}
            onClick={() => save.mutate()}
          >
            Kaydet
          </SubmitButton>
        </>
      }
    >
      <div className="grid gap-5">
        <FormField label="Başlık" error={errors.title}>
          <Input
            value={title}
            maxLength={120}
            disabled={!canEdit}
            onChange={(e) => setTitle(e.target.value)}
          />
        </FormField>
        <FormField
          label="Metin (Markdown)"
          error={errors.bodyMarkdown}
          description={`${body.length.toLocaleString('tr-TR')} / ${LEGAL_BODY_MAX.toLocaleString('tr-TR')}`}
        >
          <MarkdownEditor value={body} onChange={setBody} maxLength={LEGAL_BODY_MAX} />
        </FormField>
        {meta.bumpHint && (
          <div className="flex items-start justify-between gap-4">
            <Label htmlFor={switchId} className="block font-normal">
              Sürümü artır
              <span className="text-muted-foreground block text-xs">{meta.bumpHint}</span>
            </Label>
            <Switch id={switchId} checked={bump} disabled={!canEdit} onCheckedChange={setBump} />
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

export function SystemPage() {
  const admin = useAuthStore((s) => s.admin);
  const canEdit = hasPermission(admin, 'system:write');
  const query = useQuery({ queryKey: adminKeys.legal, queryFn: systemApi.legal });

  useEffect(() => {
    document.title = 'Sistem Ayarları · Yönetim';
  }, []);

  return (
    <>
      <PageHeader
        title="Sistem Ayarları"
        description="Yasal metinler public sayfalarda (/kvkk, /cerez-politikasi) ve form/footer bağlantılarında kullanılır."
      />
      <Tabs defaultValue="legal">
        <TabsList className="mb-4">
          <TabsTrigger value="legal">Yasal metinler</TabsTrigger>
        </TabsList>
        <TabsContent value="legal" className="grid gap-6">
          {query.isPending && <Skeleton className="h-96" />}
          {query.isError && <ErrorState onRetry={() => query.refetch()} />}
          {query.data?.map((doc) => (
            <LegalEditor
              key={`${doc.slug}-${doc.version}-${doc.updatedAt}`}
              doc={doc}
              canEdit={canEdit}
            />
          ))}
        </TabsContent>
      </Tabs>
    </>
  );
}
