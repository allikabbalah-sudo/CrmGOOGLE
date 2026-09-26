import { format, parseISO, isValid } from 'date-fns';
import { he } from 'date-fns/locale/he';

/**
 * Cleans invisible RTL/LTR Unicode directionality control characters from email strings
 * before validating or submitting.
 */
export function cleanEmail(email: string): string {
  if (!email) return '';
  return email.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '').trim();
}

/**
 * Converts a Israeli phone number into a clean https://wa.me/{digits} URL
 */
export function toWhatsAppUrl(phone: string, text?: string): string {
  if (!phone) return '#';
  // Remove non-digit chars
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }
  if (digits.startsWith('0')) {
    digits = '972' + digits.substring(1);
  }
  const encodedText = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${digits}${encodedText}`;
}

/**
 * Format date in Hebrew locale (e.g., '10 באוגוסט 2026' or 'יום שני, 10/08/2026')
 */
export function formatHebrewDate(dateStr?: string | Date | null, pattern: string = 'dd/MM/yyyy'): string {
  if (!dateStr) return '';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    if (!isValid(d)) return typeof dateStr === 'string' ? dateStr : '';
    return format(d, pattern, { locale: he });
  } catch {
    return '';
  }
}

/**
 * Get Hebrew day of week name (0=ראשון, 1=שני...)
 */
export const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function getHebrewDayName(dayIndex: number): string {
  return HEBREW_DAYS[dayIndex] || `יום ${dayIndex}`;
}

/**
 * Utility function for combining class names cleanly
 */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Generate clean unique UUID
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Format bytes into human readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
