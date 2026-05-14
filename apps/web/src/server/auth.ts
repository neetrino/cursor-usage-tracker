import { createHash, timingSafeEqual } from 'node:crypto';

export function getTrackerApiKey(): string | undefined {
  return process.env.TRACKER_API_KEY;
}

export function getAdminApiKey(): string | undefined {
  return process.env.ADMIN_API_KEY;
}

export function verifyTrackerApiKey(headerValue: string | null): boolean {
  const expected = getTrackerApiKey();
  if (!expected || !headerValue) return false;
  return timingSafeCompare(headerValue, expected);
}

export function verifyAdminApiKey(headerValue: string | null): boolean {
  const expected = getAdminApiKey();
  if (!expected || !headerValue) return false;
  return timingSafeCompare(headerValue, expected);
}

function timingSafeCompare(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export function adminCookieValue(): string {
  const key = getAdminApiKey();
  if (!key) return '';
  return createHash('sha256').update(`cursor-usage-admin:${key}`, 'utf8').digest('hex');
}

export const ADMIN_COOKIE_NAME = 'cursor_usage_admin';
