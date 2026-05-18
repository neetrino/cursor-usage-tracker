import { createHash, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { extractDeviceTokenFromRequest } from '@/server/device-token';
import { verifyDeviceToken, type VerifiedDeviceToken } from '@/server/verify-device-token';

export type TrackerAuthResult =
  | { kind: 'global' }
  | { kind: 'device'; verified: VerifiedDeviceToken };

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

export async function resolveTrackerAuth(
  req: Request,
  prisma: PrismaClient,
): Promise<TrackerAuthResult | null> {
  const deviceRaw = extractDeviceTokenFromRequest(req);
  if (deviceRaw) {
    const verified = await verifyDeviceToken(prisma, deviceRaw);
    if (verified) return { kind: 'device', verified };
    return null;
  }
  const trackerKey = req.headers.get('x-tracker-api-key');
  if (verifyTrackerApiKey(trackerKey)) {
    return { kind: 'global' };
  }
  return null;
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

export function verifyAdminSessionFromRequest(req: Request): boolean {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const escaped = ADMIN_COOKIE_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = cookieHeader.match(new RegExp(`${escaped}=([^;]+)`));
  if (!match?.[1]) return false;
  const expected = adminCookieValue();
  return Boolean(expected && match[1] === expected);
}
