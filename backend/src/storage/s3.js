// ARCHITECTURE.md §8.1 — S3 uyumlu sürücü iskeleti (v1 dışı). Arayüz local.js ile aynıdır;
// gerçek uygulama gerektiğinde @aws-sdk/client-s3 eklenip bu fonksiyonlar doldurulur.
const notImplemented = () => {
  throw new Error('S3 depolama sürücüsü henüz uygulanmadı. STORAGE_DRIVER=local kullan.');
};

export function createS3Storage() {
  return {
    driver: 's3',
    resolveKey: notImplemented,
    put: notImplemented,
    stat: notImplemented,
    createReadStream: notImplemented,
    remove: notImplemented,
  };
}
