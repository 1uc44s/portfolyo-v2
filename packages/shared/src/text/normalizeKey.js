// Türkçe uyumlu, büyük/küçük harf duyarsız benzersizlik anahtarı.
/** @param {string} value */
export const normalizeKey = (value) =>
  String(value).normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR');
