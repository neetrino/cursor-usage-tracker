import { verifyAdminApiKey, verifyAdminSessionFromRequest } from '@/server/auth';
import { jsonResponse } from '@/server/http';

export function isAdminAuthorized(req: Request): boolean {
  const key = req.headers.get('x-admin-api-key');
  return verifyAdminApiKey(key) || verifyAdminSessionFromRequest(req);
}

export function unauthorizedAdminJson(): Response {
  return jsonResponse({ ok: false, error: 'Unauthorized' }, { status: 401 });
}
