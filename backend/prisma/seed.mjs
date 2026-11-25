// yalnızca SİSTEM kayıtları. İdempotent ve ezmeyen:
// kayıt varsa dokunulmaz (admin'in düzenlediği içerik korunur).
// Kategori, proje, medya ve admin hesabı TOHUMLANMAZ. İstisna (2026-11-16):
// varsayılan linkler bir kez eklenir (src/modules/links/defaults.js).
import { prisma } from '../src/lib/prisma.js';
import { seedDefaultLinksOnce } from '../src/modules/links/defaults.js';

const TEMPLATES = [
  {
    key: 'PASSWORD_RESET',
    channel: 'EMAIL',
    subject: '{{siteName}} — Şifre sıfırlama',
    body: [
      'Merhaba {{adminName}},',
      '',
      'Yönetim paneli için bir şifre sıfırlama isteği aldık. Aşağıdaki bağlantı {{expiresInMinutes}} dakika geçerlidir ve yalnızca bir kez kullanılabilir:',
      '{{resetUrl}}',
      '',
      'Bu isteği sen yapmadıysan bu e-postayı yok sayabilirsin; şifren değişmeyecek.',
    ].join('\n'),
  },
  {
    key: 'CONTACT_NOTIFICATION',
    channel: 'EMAIL',
    subject: '{{siteName}} — Yeni mesaj: {{subject}}',
    body: [
      '{{senderFullName}} ({{senderEmail}}, {{senderPhone}}) yeni bir mesaj gönderdi:',
      '',
      '{{message}}',
      '',
      'Panelde görüntüle: {{adminUrl}}',
    ].join('\n'),
  },
  {
    key: 'SMTP_TEST',
    channel: 'EMAIL',
    subject: '{{siteName}} — SMTP testi',
    body: 'Bu bir test e-postasıdır. Gönderim zamanı: {{sentAt}}. E-posta ayarların çalışıyor.',
  },
  {
    key: 'CONTACT_REPLY_EMAIL',
    channel: 'EMAIL',
    subject: 'Re: {{subject}}',
    body: [
      'Merhaba {{firstName}},',
      '',
      '{{siteName}} üzerinden gönderdiğin mesaj için teşekkürler.',
      '',
      '{{ownerName}}',
    ].join('\n'),
  },
];

const LEGAL_DOCUMENTS = [
  {
    key: 'KVKK_NOTICE',
    title: 'KVKK Aydınlatma Metni',
    bodyMarkdown: [
      '> **TASLAK** — Yayına almadan önce hukuki olarak gözden geçirilmeli ve Sistem > Yasal metinler ekranından güncellenmelidir.',
      '',
      '## Veri sorumlusu',
      'Bu site, site sahibi tarafından kişisel amaçla işletilmektedir.',
      '',
      '## İşlenen veriler ve amaçları',
      '- **İletişim formu:** ad, soyad, telefon, e-posta, konu ve mesaj — yalnızca mesajına dönüş yapmak için.',
      '- **İndirme sayacı ve izinli analitik:** IP adresi saklanmaz; günlük değişen tuzla geri döndürülemez biçimde özetlenir.',
      '',
      '## Saklama süresi',
      'İletişim mesajları 12 ay sonra kalıcı olarak silinir.',
      '',
      '## Hakların',
      'KVKK md. 11 kapsamındaki taleplerini iletişim formu üzerinden iletebilirsin.',
    ].join('\n'),
  },
  {
    key: 'COOKIE_POLICY',
    title: 'Çerez Politikası',
    bodyMarkdown: [
      '> **TASLAK** — Yayına almadan önce hukuki olarak gözden geçirilmeli.',
      '',
      '## Zorunlu çerezler ve yerel depolama',
      'Yönetim paneli oturumu ve güvenliği için gerekli çerezler ile tema, görünüm ve ses tercihlerin cihazında saklanır. Bunlar kapatılamaz.',
      '',
      '## Analitik (isteğe bağlı)',
      'Yalnızca izin verirsen, birinci taraf ve çerezsiz ziyaret sayımı yapılır. İznini istediğin zaman sayfa altındaki "Çerez tercihleri" bağlantısından değiştirebilirsin.',
    ].join('\n'),
  },
];

const INTEGRATIONS = ['DISCORD', 'SPOTIFY', 'GITHUB'];

/** Kayıt yoksa oluştur, varsa hiçbir alanı değiştirme. */
const ensure = (delegate, where, create) => delegate.upsert({ where, create, update: {} });

// Tech Stack başlangıç öğeleri (referans görseldeki 7 teknoloji). Yalnızca bir kez eklenir
// (SystemState "tech_stack_seeded"); admin sonradan silse de yeniden oluşmaz. Görseller adminden.
const TECH_STACK_ITEMS = [
  [
    'React',
    'Sitenin tüm arayüzü React 19 ile: hero, müzik oynatıcı, durum kartları, projeler, iletişim formu ve yönetim paneli bileşen bileşen kuruldu.',
  ],
  [
    'ViteJS',
    'Geliştirme sunucusu ve üretim derlemesi Vite ile. Sayfalar parçalara bölünüyor; ziyaretçi ilk açılışta yalnızca gereken kodu indiriyor.',
  ],
  [
    'NodeJS',
    'Sunucu tarafı Node.js 24 üzerinde: günlük içerik rotasyonu, medya işleme (görsel/video), zamanlanmış işler ve entegrasyon işçileri.',
  ],
  [
    'ExpressJS',
    'REST API Express 5 ile: kimlik doğrulama, 2FA, yetki kontrolü, hız sınırları ve güvenlik başlıkları.',
  ],
  [
    'PostgreSQL',
    'Tüm içerik, ayarlar ve sayaçlar PostgreSQL’de. Eşzamanlı işlemler için advisory lock kullanılıyor.',
  ],
  [
    'Prisma',
    'Veritabanı şeması ve migration’lar Prisma ile; sorgular parametreli ve şema tek kaynaktan yönetiliyor.',
  ],
  [
    'Rest API / AXIOS',
    'Ön yüz ile sunucu REST API üzerinden konuşuyor; Axios oturum yenileme ve hata yönetimini merkezi olarak yapıyor.',
  ],
];

// Varsayılan bölümler (migration da oluşturur; boş veritabanında seed tamamlar).
const TECH_STACK_GROUPS = [
  { titleTop: 'My', titleMain: 'Tech', titleBottom: 'Stack', sortOrder: 0 },
  { titleTop: 'My', titleMain: 'Security', titleBottom: 'Skill', sortOrder: 10 },
];

async function seedTechStackOnce() {
  if ((await prisma.techStackGroup.count()) === 0) {
    await prisma.techStackGroup.createMany({ data: TECH_STACK_GROUPS });
  }
  const flag = await prisma.systemState.findUnique({ where: { key: 'tech_stack_seeded' } });
  if (flag) return 0;
  if ((await prisma.techStackItem.count()) === 0) {
    const first = await prisma.techStackGroup.findFirst({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    await prisma.techStackItem.createMany({
      data: TECH_STACK_ITEMS.map(([label, description], i) => ({
        groupId: first.id,
        label,
        description,
        sortOrder: i * 10,
      })),
    });
  }
  await prisma.systemState.create({
    data: { key: 'tech_stack_seeded', value: { at: new Date().toISOString() } },
  });
  return TECH_STACK_ITEMS.length;
}

async function main() {
  await ensure(prisma.siteSettings, { id: 1 }, { id: 1 });
  await ensure(prisma.heroSettings, { id: 1 }, { id: 1 });
  await ensure(prisma.aboutContent, { id: 1 }, { id: 1 });
  await ensure(prisma.mailSettings, { id: 1 }, { id: 1 });

  for (const provider of INTEGRATIONS) {
    await ensure(prisma.integrationSetting, { provider }, { provider });
  }
  for (const template of TEMPLATES) {
    await ensure(prisma.messageTemplate, { key: template.key }, { ...template, isSystem: true });
  }
  for (const doc of LEGAL_DOCUMENTS) {
    await ensure(prisma.legalDocument, { key: doc.key }, doc);
  }

  const techStack = await seedTechStackOnce();
  const links = await seedDefaultLinksOnce();

  console.warn(
    `Tech Stack başlangıç öğeleri: ${techStack}, varsayılan link: ${links}. Seed tamam: 4 tekil ayar, ${INTEGRATIONS.length} entegrasyon, ${TEMPLATES.length} şablon, ${LEGAL_DOCUMENTS.length} yasal metin.`,
  );
}

try {
  await main();
} catch (err) {
  console.error('Seed başarısız:', err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
