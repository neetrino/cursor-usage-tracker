import { getPrisma } from '@/server/db';
import { resolveTrackerAuth } from '@/server/auth';
import { readLocalMarkerDedupeMs, shouldSkipLocalMarkerInsert } from '@/server/local-marker-dedupe';
import { trackerEventsRequestSchema } from '@cursor-usage-tracker/shared/schemas';
import type { LocalAiEventPayload } from '@cursor-usage-tracker/shared/schemas';
import { runMatchingPass } from '@/server/matching/runMatching';
import { jsonResponse } from '@/server/http';

export const runtime = 'nodejs';

function isPrismaUniqueViolation(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as { code?: string }).code === 'P2002';
}

function enforceDeviceIdentity(
  ev: LocalAiEventPayload,
  verified: {
    internalUser: { userKey: string; name: string; computerId: string };
    computerId: string;
    owningUser: string;
  },
): LocalAiEventPayload | null {
  if (ev.computerId !== verified.computerId || ev.owningUser !== verified.owningUser) {
    return null;
  }
  return {
    ...ev,
    userKey: verified.internalUser.userKey,
    userName: verified.internalUser.name,
    computerId: verified.computerId,
    owningUser: verified.owningUser,
  };
}

export async function POST(req: Request): Promise<Response> {
  const prisma = getPrisma();
  const auth = await resolveTrackerAuth(req, prisma);
  if (!auth) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = trackerEventsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonResponse({ error: parsed.error.flatten() }, { status: 400 });
  }

  const dedupeMs = readLocalMarkerDedupeMs();
  let inserted = 0;
  let skipped = 0;

  for (let ev of parsed.data.events) {
    if (auth.kind === 'device') {
      const enforced = enforceDeviceIdentity(ev, auth.verified);
      if (!enforced) {
        return jsonResponse({ error: 'Device token identity mismatch' }, { status: 403 });
      }
      ev = enforced;
    }

    if (ev.marker === 'wakelock_acquired') {
      skipped += 1;
      continue;
    }

    const skipDedupe = await shouldSkipLocalMarkerInsert({
      prisma,
      marker: ev.marker,
      userKey: ev.userKey,
      computerId: ev.computerId,
      owningUser: ev.owningUser,
      timestampMs: ev.timestampMs,
      dedupeMs,
    });
    if (skipDedupe) {
      skipped += 1;
      continue;
    }

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
      inserted += 1;
    } catch (e: unknown) {
      if (isPrismaUniqueViolation(e)) {
        skipped += 1;
        continue;
      }
      throw e;
    }
  }

  await runMatchingPass(prisma);

  return jsonResponse({ ok: true, inserted, skipped });
}
