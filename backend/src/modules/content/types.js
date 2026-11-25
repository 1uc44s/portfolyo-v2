// medya içerik türlerinin backend tanımları (Prisma modeli, FK'ler, audit öneki).
// Dosya yuvaları ve anahtarlar @my-portfolyo/shared MEDIA_CONTENT'ten gelir (istemciyle tek kaynak).
import { MEDIA_CONTENT } from '@my-portfolyo/shared';

/** field → { fk: DB sütunu, relation: Prisma ilişki adı } */
const SLOT_DB = {
  backgrounds: { file: { fk: 'assetId', relation: 'asset' } },
  musics: {
    audio: { fk: 'audioAssetId', relation: 'audio' },
    cover: { fk: 'coverAssetId', relation: 'cover' },
  },
  pfps: { file: { fk: 'assetId', relation: 'asset' } },
  'name-overlays': { file: { fk: 'assetId', relation: 'asset' } },
  cursors: {
    normal: { fk: 'normalAssetId', relation: 'normal' },
    click: { fk: 'clickAssetId', relation: 'click' },
  },
};

const META = {
  backgrounds: { model: 'background', entityType: 'Background', audit: 'BACKGROUND' },
  musics: { model: 'music', entityType: 'Music', audit: 'MUSIC' },
  pfps: { model: 'profileMedia', entityType: 'ProfileMedia', audit: 'PROFILE_MEDIA' },
  cursors: { model: 'cursorSet', entityType: 'CursorSet', audit: 'CURSOR_SET' },
  'name-overlays': { model: 'nameOverlay', entityType: 'NameOverlay', audit: 'NAME_OVERLAY' },
};

/**
 * @typedef {{ field: string, kind: string, fk: string, relation: string }} Slot
 * @typedef {{ type: string, model: string, entityType: string, audit: string, slots: Slot[],
 *   flags: string[], sortable: boolean, replaceAll: boolean, primary: Slot,
 *   include: Record<string, true> }} ContentType
 */

/** @type {Record<string, ContentType>} */
export const CONTENT_TYPES = Object.freeze(
  Object.fromEntries(
    Object.entries(MEDIA_CONTENT).map(([type, def]) => {
      const slots = def.slots.map((s) => ({ ...s, ...SLOT_DB[type][s.field] }));
      return [
        type,
        {
          type,
          ...META[type],
          ...def,
          slots,
          // Liste filtresi (`type`) ve önizleme için ana yuva: müzikte kapak, cursor'da normal.
          primary: type === 'musics' ? slots[1] : slots[0],
          include: Object.fromEntries(slots.map((s) => [s.relation, true])),
        },
      ];
    }),
  ),
);
