import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTZS(amount: number | string) {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS',
    maximumFractionDigits: 0,
  }).format(n);
}

/** True when compare-at is a real higher list price (show strike + badge) */
export function hasDiscount(
  price: number | string,
  compareAtPrice?: number | string | null,
) {
  if (compareAtPrice == null || compareAtPrice === '') return false;
  const p = Number(price);
  const c = Number(compareAtPrice);
  return Number.isFinite(p) && Number.isFinite(c) && c > p;
}

export function discountPercent(
  price: number | string,
  compareAtPrice: number | string,
) {
  const p = Number(price);
  const c = Number(compareAtPrice);
  if (!c || c <= p) return 0;
  return Math.round(((c - p) / c) * 100);
}

export function formatRelative(date: string | Date) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
