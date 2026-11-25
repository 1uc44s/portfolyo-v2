// Medya Yönetimi sekmeleri, alan etiketleri, rozetler ve meta satırı biçimi.
import { MEDIA_CONTENT, formatBytes } from '@my-portfolyo/shared';

const SLOT_LABELS = {
  backgrounds: { file: 'Arka plan dosyası' },
  musics: { audio: 'MP3 dosyası', cover: 'Kapak görseli' },
  pfps: { file: 'Profil görseli' },
  cursors: { normal: 'Normal imleç', click: 'Tıklama imleci' },
  'name-overlays': { file: 'GIF dosyası' },
};

const SLOT_HINTS = {
  BACKGROUND: 'MP4 (≤ 200 MB, ≤ 120 sn) veya JPG/PNG/WEBP/GIF (≤ 30 MB).',
  MUSIC_AUDIO: 'MP3 · en fazla 30 MB ve 15 dk. Süre otomatik okunur.',
  MUSIC_COVER: 'JPG/PNG/GIF · en fazla 10 MB.',
  PROFILE: 'MP4 (≤ 50 MB, ≤ 30 sn) veya JPG/PNG/GIF (≤ 15 MB).',
  NAME_OVERLAY:
    'Yalnızca GIF · en fazla 10 MB. Şeffaf zeminli (ör. düşen beyaz parçacıklar) önerilir.',
  CURSOR: 'PNG, CUR veya ICO · en fazla 128×128 px ve 512 KB. Önerilen 32×32.',
};

export const CONTENT_TABS = [
  {
    type: 'backgrounds',
    label: 'Arka planlar',
    singular: 'Arka plan',
    description:
      'Sahnenin arkasında görünen video veya görsel; her gün biri rotasyonla seçilir. “Duvar kağıdı” açık olanlar ziyaretçilerin indirebileceği Duvar Kağıtları sayfasında listelenir.',
    aspect: 'aspect-video',
  },
  {
    type: 'musics',
    label: 'Müzikler',
    singular: 'Müzik',
    description: 'Global oynatıcıda çalan parçalar. MP3 ve kapak birlikte yüklenir.',
    aspect: 'aspect-square',
  },
  {
    type: 'pfps',
    label: 'Profil fotoğrafları',
    singular: 'Profil fotoğrafı',
    description: 'Hero profil görseli rotasyonu ve isteğe bağlı indirme sayfası.',
    aspect: 'aspect-square',
  },
  {
    type: 'name-overlays',
    label: 'İsim Efektleri',
    singular: 'İsim Efekti',
    description:
      'Hero ismin üstünde oynayan GIF katmanı (Hero > İsim efektleri > İsim Efekti açıkken). Her gün biri rotasyonla seçilir.',
    aspect: 'aspect-video',
  },
  {
    type: 'cursors',
    label: 'Cursor setleri',
    singular: 'Cursor seti',
    description: 'Normal ve tıklama imleci birlikte; hotspot imlecin tıklama noktasıdır.',
    aspect: 'aspect-[2/1]',
  },
].map((tab) => ({
  ...tab,
  ...MEDIA_CONTENT[tab.type],
  slots: MEDIA_CONTENT[tab.type].slots.map((slot) => ({
    ...slot,
    label: SLOT_LABELS[tab.type][slot.field],
    hint: SLOT_HINTS[slot.kind],
  })),
}));

export const LIBRARY_TABS = [
  {
    type: 'project-images',
    kind: 'PROJECT_IMAGE',
    label: 'Proje görselleri',
    usageType: 'PROJECT',
  },
  { type: 'link-images', kind: 'LINK_IMAGE', label: 'Link görselleri', usageType: 'LINK' },
  {
    type: 'tech-stack-images',
    kind: 'TECH_STACK_IMAGE',
    label: 'Tech Stack görselleri',
    usageType: 'TECH_STACK',
  },
];

export const FLAG_LABELS = {
  isActive: { label: 'Aktif', hint: 'Kapalıysa sitede hiç kullanılmaz.' },
  isDownloadable: { label: 'İndirilebilir', hint: 'İndirme sayfasında listelenir.' },
  rotationEnabled: { label: 'Rotasyonda', hint: 'Günlük otomatik seçim havuzunda.' },
  isWallpaper: {
    label: 'Duvar kağıdı',
    hint: 'Duvar Kağıtları sayfasında listelenir ve indirilebilir.',
  },
};

export const isBusy = (status) => status === 'PENDING' || status === 'PROCESSING';

const TYPE_LABELS = {
  IMAGE: null,
  ANIMATED_IMAGE: 'GIF',
  VIDEO: 'MP4',
  AUDIO: 'MP3',
  CURSOR: null,
};

const extensionOf = (asset) => {
  if (TYPE_LABELS[asset.mediaType]) return TYPE_LABELS[asset.mediaType];
  const sub = asset.mimeType?.split('/')[1] ?? '';
  return { 'x-icon': 'ICO', 'vnd.microsoft.icon': 'ICO' }[sub] ?? sub.toUpperCase();
};

export function formatDuration(ms) {
  if (!ms && ms !== 0) return null;
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** meta satırı: "2,4 MB · MP4 · 1920×1080 · 0:14". */
export function assetMeta(asset) {
  if (!asset) return '';
  return [
    formatBytes(asset.sizeBytes),
    extensionOf(asset),
    asset.width && asset.height ? `${asset.width}×${asset.height}` : null,
    formatDuration(asset.durationMs),
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * hesaplanmış durum rozetleri. tone: success | muted | warning | danger.
 */
export function statusBadges(item) {
  if (item.status === 'FAILED') return [{ label: 'Hata', tone: 'danger' }];
  if (isBusy(item.status)) {
    return [{ label: item.status === 'PENDING' ? 'Sırada' : 'İşleniyor', tone: 'warning' }];
  }
  const badges = [];
  const { isPublic, isDownloadable, isRotationEligible } = item.visibility;
  if ('isWallpaper' in item) {
    // Arka plan: sitede her zaman rotasyonla kullanılır; duvar kağıdıysa ayrıca public listede.
    if (!item.isActive) badges.push({ label: 'Pasif', tone: 'muted' });
    if (isPublic) badges.push({ label: 'Duvar kağıdı', tone: 'success' });
  } else if (isPublic !== null) {
    badges.push(
      isPublic ? { label: 'Yayında', tone: 'success' } : { label: 'Gizli', tone: 'muted' },
    );
  } else if (!item.isActive) {
    badges.push({ label: 'Pasif', tone: 'muted' });
  }
  if (isDownloadable && !('isWallpaper' in item)) {
    badges.push({ label: 'İndirilebilir', tone: 'success' });
  }
  if (isRotationEligible) badges.push({ label: 'Rotasyonda', tone: 'success' });
  else if (isRotationEligible === false && item.isActive) {
    badges.push({ label: 'Rotasyon dışı', tone: 'muted' });
  }
  return badges;
}
