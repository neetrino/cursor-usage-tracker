import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'cut_dev_';
const TOKEN_BYTES = 32;

export type GeneratedDeviceToken = {
  rawToken: string;
  tokenHash: string;
  tokenPrefix: string;
  tokenLast4: string;
};

export function hashDeviceToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function generateDeviceToken(): GeneratedDeviceToken {
  const secret = randomBytes(TOKEN_BYTES).toString('base64url');
  const rawToken = `${TOKEN_PREFIX}${secret}`;
  const tokenHash = hashDeviceToken(rawToken);
  const tokenPrefix = rawToken.slice(0, TOKEN_PREFIX.length + 8);
  const tokenLast4 = rawToken.slice(-4);
  return { rawToken, tokenHash, tokenPrefix, tokenLast4 };
}

export function extractDeviceTokenFromRequest(req: Request): string | null {
  const bearer = req.headers.get('authorization');
  if (bearer) {
    const match = bearer.match(/^Bearer\s+(.+)$/i);
    const token = match?.[1]?.trim();
    if (token) return token;
  }
  const header = req.headers.get('x-device-token')?.trim();
  return header || null;
}
