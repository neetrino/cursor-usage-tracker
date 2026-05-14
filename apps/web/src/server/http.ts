function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export function jsonResponse(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data, jsonReplacer), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init?.headers ?? {}),
    },
  });
}
