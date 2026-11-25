// sırasıyla 12 menü öğesi ve izin anahtarları.
import {
  Activity,
  FolderKanban,
  Images,
  Inbox,
  Layers,
  LayoutDashboard,
  Link2,
  ScrollText,
  Settings2,
  ShieldCheck,
  Tags,
  UserRound,
  Wrench,
} from 'lucide-react';
import { hasPermission } from '@my-portfolyo/shared';

/** phase: modülün geleceği yol haritası fazı (ROADMAP.md); null = hazır. */
export const NAV_GROUPS = [
  {
    label: 'Genel',
    items: [
      {
        to: '/admin',
        label: 'Dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard:read',
        end: true,
        phase: null,
      },
      {
        to: '/admin/settings',
        label: 'Site Ayarları',
        icon: Settings2,
        permission: 'settings:read',
        phase: null,
      },
      {
        to: '/admin/hero',
        label: 'Hero Section',
        icon: UserRound,
        permission: 'hero:read',
        phase: null,
      },
    ],
  },
  {
    label: 'İçerik',
    items: [
      {
        to: '/admin/media',
        label: 'Medya Yönetimi',
        icon: Images,
        permission: 'media:read',
        phase: null,
      },
      {
        to: '/admin/status',
        label: 'Durumlar',
        icon: Activity,
        permission: 'status:read',
        phase: null,
      },
      {
        to: '/admin/projects',
        label: 'Projeler',
        icon: FolderKanban,
        permission: 'projects:read',
        phase: null,
      },
      {
        to: '/admin/categories',
        label: 'Kategoriler',
        icon: Tags,
        permission: 'categories:read',
        phase: null,
      },
      { to: '/admin/links', label: 'Linkler', icon: Link2, permission: 'links:read', phase: null },
      {
        to: '/admin/tech-stack',
        label: 'Tech Stack',
        icon: Layers,
        permission: 'settings:read',
        phase: null,
      },
    ],
  },
  {
    label: 'Gelen',
    items: [
      {
        to: '/admin/messages',
        label: 'İletişim Mesajları',
        icon: Inbox,
        permission: 'messages:read',
        badge: 'unreadMessages',
        phase: null,
      },
    ],
  },
  {
    label: 'Hesap ve sistem',
    items: [
      {
        to: '/admin/account',
        label: 'Hesap Ayarları',
        icon: ShieldCheck,
        permission: null,
        phase: null,
      },
      {
        to: '/admin/system',
        label: 'Sistem Ayarları',
        icon: Wrench,
        permission: 'system:read',
        phase: null,
      },
      {
        to: '/admin/audit',
        label: 'Güvenlik ve İşlem Logları',
        icon: ScrollText,
        permission: 'audit:read',
        phase: null,
      },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** İzni olmayan öğeler gösterilmez. */
export function visibleNavGroups(admin) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.permission || hasPermission(admin, item.permission)),
  })).filter((group) => group.items.length > 0);
}

/** Yol için en uzun eşleşen menü öğesi (breadcrumb/başlık). */
export function findNavItem(pathname) {
  return [...NAV_ITEMS]
    .sort((a, b) => b.to.length - a.to.length)
    .find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
}

/** yalnızca /admin altındaki göreli yollar (open redirect önlemi). */
export function safeNextPath(value) {
  if (typeof value !== 'string') return '/admin';
  if (!value.startsWith('/admin') || value.startsWith('//') || value.includes('\\'))
    return '/admin';
  return value;
}
