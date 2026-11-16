// SRS §10 hata yanıtını react-hook-form alanlarına ve toast'a dağıtır.
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/api/client.js';

/**
 * 422 detaylarını ilgili alanlara yazar; eşleşmeyenler ve diğer hatalar toast olur.
 * @param {unknown} error
 * @param {(name: string, error: { type: string, message: string }) => void} [setError]
 * @param {string[]} [fieldNames]
 */
export function handleFormError(error, setError, fieldNames = []) {
  const details = error?.response?.data?.error?.details;
  let unmatched = !Array.isArray(details) || details.length === 0;
  if (Array.isArray(details) && setError) {
    for (const detail of details) {
      if (fieldNames.includes(detail.path)) {
        setError(detail.path, { type: 'server', message: detail.message });
      } else {
        unmatched = true;
      }
    }
  }
  if (unmatched) toast.error(getErrorMessage(error));
}

/** Hata kodunu döndürür (ör. 'INVALID_CREDENTIALS'). */
export const errorCode = (error) => error?.response?.data?.error?.code ?? null;
