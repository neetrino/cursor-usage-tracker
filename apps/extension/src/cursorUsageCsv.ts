import type { CursorUsageApiEvent } from '@cursor-usage-tracker/shared/schemas';
import { asString } from './stringUtil';

const HEADER_ALIASES: Record<string, readonly string[]> = {
  timestamp: [
    'timestamp',
    'date',
    'time',
    'event_time',
    'eventtime',
    'created_at',
    'createdat',
    'datetime',
    'event_date',
  ],
  model: ['model', 'model_name', 'modelname'],
  inputTokens: ['input_tokens', 'inputtokens', 'input', 'input_tokens_count'],
  outputTokens: ['output_tokens', 'outputtokens', 'output', 'output_tokens_count'],
  cacheReadTokens: [
    'cache_read_tokens',
    'cachereadtokens',
    'cache_read',
    'cache_read_tokens_count',
    'cached_tokens',
  ],
  owningUser: ['owning_user', 'owninguser', 'user', 'user_id', 'userid', 'account_id', 'accountid'],
  kind: ['kind', 'type', 'event_type', 'eventtype'],
  chargedCents: ['charged_cents', 'chargedcents', 'cost_cents', 'cost'],
};

function normalizeHeader(header: string): string {
  return asString(header)
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function resolveFieldKey(normalizedHeader: string): keyof typeof HEADER_ALIASES | null {
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalizedHeader)) {
      return field as keyof typeof HEADER_ALIASES;
    }
  }
  return null;
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i += 1) {
    const ch = csv[i];
    const next = csv[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      if (ch === '\r') i += 1;
      continue;
    }
    if (ch === '\r') {
      row.push(cell);
      cell = '';
      if (row.some((c) => c.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    cell += ch;
  }

  row.push(cell);
  if (row.some((c) => c.trim().length > 0)) {
    rows.push(row);
  }
  return rows;
}

function parseIntField(value: string): number {
  const t = asString(value).trim().replace(/,/g, '');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
}

function parseTimestampMsString(value: string): string {
  const t = asString(value).trim();
  if (!t) {
    throw new Error('Missing timestamp');
  }
  if (/^\d+$/.test(t)) {
    return t;
  }
  const ms = Date.parse(t);
  if (!Number.isFinite(ms)) {
    throw new Error(`Could not parse timestamp: ${t.slice(0, 40)}`);
  }
  return String(ms);
}

export function csvToUsageEvents(csv: string, defaultOwningUser: string): CursorUsageApiEvent[] {
  const ownerDefault = asString(defaultOwningUser).trim();
  if (!ownerDefault) {
    throw new Error('owningUser is required to map CSV rows');
  }

  const rows = parseCsvRows(csv);
  if (rows.length < 2) {
    return [];
  }

  const headerRow = rows[0];
  const fieldByCol: Array<keyof typeof HEADER_ALIASES | null> = headerRow.map((h) =>
    resolveFieldKey(normalizeHeader(h)),
  );

  const events: CursorUsageApiEvent[] = [];

  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    const record: Partial<Record<keyof typeof HEADER_ALIASES, string>> = {};
    for (let c = 0; c < fieldByCol.length; c += 1) {
      const key = fieldByCol[c];
      if (!key) continue;
      record[key] = asString(cells[c]).trim();
    }

    const timestampRaw = record.timestamp;
    const model = asString(record.model).trim();
    if (!timestampRaw || !model) {
      continue;
    }

    const owningUser = asString(record.owningUser).trim() || ownerDefault;
    const inputTokens = parseIntField(record.inputTokens ?? '0');
    const outputTokens = parseIntField(record.outputTokens ?? '0');
    const cacheReadTokens = parseIntField(record.cacheReadTokens ?? '0');

    const event: CursorUsageApiEvent = {
      timestamp: parseTimestampMsString(timestampRaw),
      model,
      owningUser,
      tokenUsage: { inputTokens, outputTokens, cacheReadTokens },
    };

    const kind = asString(record.kind).trim();
    if (kind) event.kind = kind;

    const chargedRaw = asString(record.chargedCents).trim();
    if (chargedRaw) {
      const charged = parseIntField(chargedRaw);
      event.chargedCents = charged;
    }

    events.push(event);
  }

  return events;
}
