import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

export async function readNewLinesSinceByteOffset(
  filePath: string,
  startByteOffset: number,
): Promise<{ nextOffset: number; lines: string[] }> {
  const s = await stat(filePath);
  const size = s.size;

  let byteOffset = startByteOffset;
  if (byteOffset < 0 || byteOffset > size) {
    byteOffset = 0;
  }
  if (byteOffset >= size) {
    return { nextOffset: size, lines: [] };
  }

  const stream = createReadStream(filePath, {
    start: byteOffset,
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
