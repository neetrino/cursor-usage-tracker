import { prisma } from '@/server/db';
import { verifyTrackerApiKey } from '@/server/auth';
import { trackerEventsRequestSchema } from '@cursor-usage-tracker/shared/schemas';
import { runMatchingPass } from '@/server/matching/runMatching';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

function isPrismaUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002';
}

export async function POST(req: Request): Promise<Response> {
  const key = req.headers.get('x-tracker-api-key');
  if (!verifyTrackerApiKey(key)) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = trackerEventsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.flatten() }, { status: 400 });
  }

  for (const ev of parsed.data.events) {
    const internal = await prisma.internalUser.findUnique({
      where: { userKey: ev.userKey },
      include: { cursorAccount: true },
    });
    const userId =
      internal && internal.cursorAccount.owningUser === ev.owningUser ? internal.id : null;

    try {
      await prisma.localAiEvent.create({
        data: {
          userId,
          userKey: ev.userKey,
          userName: ev.userName,
          computerId: ev.computerId,
          owningUser: ev.owningUser,
          timestampMs: ev.timestampMs,
          timestampUtc: new Date(ev.timestampUtc),
          source: ev.source,
          marker: ev.marker,
          rawLineHash: ev.rawLineHash,
          syncedAt: new Date(),
        },
      });
    } catch (e: unknown) {
      if (isPrismaUniqueViolation(e)) {
        continue;
      }
      throw e;
    }
  }

  await runMatchingPass(prisma);

  return jsonResponse({ ok: true });
}
