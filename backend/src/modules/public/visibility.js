// yayın durumu modeli: public görünürlük / indirilebilirlik / rotasyon uygunluğu tek yerde.
// Hem admin rozetleri (hesaplanmış durum) hem public sorgular (Prisma where) bunu kullanır.

const isReady = (asset) => asset?.processingStatus === 'READY';
const READY = { processingStatus: 'READY' };

/** Prisma where: public pfp indirme listesine girer. */
export const DOWNLOADABLE_WHERE = Object.freeze({
  isActive: true,
  isDownloadable: true,
  asset: READY,
});

/** Prisma where: background /wallpapers'ta listelenir ve indirilir (isWallpaper bayrağı). */
export const WALLPAPER_WHERE = Object.freeze({
  isActive: true,
  isWallpaper: true,
  asset: READY,
});

/**
 * Kayıt + yüklenmiş asset ilişkileri → { isPublic, isDownloadable, isRotationEligible }.
 * Uygulanmayan nitelik null döner (ör. background public listede yer almaz).
 * @param {string} type MEDIA_CONTENT anahtarı
 */
export function visibilityOf(type, record) {
  const active = record.isActive === true;
  const rotation = active && record.rotationEnabled === true;
  switch (type) {
    case 'pfps':
      return {
        isPublic: active && isReady(record.asset),
        isDownloadable: active && record.isDownloadable && isReady(record.asset),
        isRotationEligible: rotation && isReady(record.asset),
      };
    case 'backgrounds': {
      const wallpaper = active && record.isWallpaper === true && isReady(record.asset);
      return {
        isPublic: wallpaper,
        isDownloadable: wallpaper,
        isRotationEligible: rotation && isReady(record.asset),
      };
    }
    case 'name-overlays':
      // İsim GIF katmanı: public liste yok; yalnızca rotasyon.
      return {
        isPublic: null,
        isDownloadable: null,
        isRotationEligible: rotation && isReady(record.asset),
      };
    case 'musics':
      return {
        isPublic: null,
        isDownloadable: null,
        isRotationEligible: rotation && isReady(record.audio) && isReady(record.cover),
      };
    case 'cursors':
      return {
        isPublic: null,
        isDownloadable: null,
        isRotationEligible: rotation && isReady(record.normal) && isReady(record.click),
      };
    default:
      throw new Error(`Bilinmeyen içerik türü: ${type}`);
  }
}
