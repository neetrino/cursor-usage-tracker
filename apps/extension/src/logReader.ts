import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

export async function readNewLinesSinceByteOffset(
  filePath: string,
  startByteOffset: number,
): Promise<{ nextOffset: number; lines: string[] }> {
  const s = await stat(filePath);
  const size = s.size;
  if (startByteOffset > size) {
    return { nextOffset: size, lines: [] };
  }

  const stream = createReadStream(filePath, {
    start: startByteOffset,
    end: size - 1,
    encoding: 'utf8',
  });

  const lines: string[] = [];
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    lines.push(line);
  }

  return { nextOffset: size, lines };
}

export async function readLastTextChunk(filePath: string, maxBytes: number): Promise<string> {
  const buf = await readFile(filePath);
  const slice = buf.subarray(Math.max(0, buf.length - maxBytes));
  return slice.toString('utf8');
}
