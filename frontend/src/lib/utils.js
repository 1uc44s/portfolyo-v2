import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn/ui sınıf birleştirici. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
