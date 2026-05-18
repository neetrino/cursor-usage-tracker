import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';

export type ReadNewLinesResult = {
  nextOffset: number;
  lines: string[];
  truncated: boolean;
};

export async function readNewLinesSinceByteOffset(
  filePath: string,
  startByteOffset: number,
): Promise<ReadNewLinesResult> {
  let s;
  try {
    s = await stat(filePath);
  } catch {
    return { nextOffset: Math.max(0, startByteOffset), lines: [], truncated: false };
  }

  const fileSize = s.size;
  let byteOffset = startByteOffset;
  let truncated = false;

  if (byteOffset < 0) {
    byteOffset = 0;
  }
  if (byteOffset > fileSize) {
    byteOffset = 0;
    truncated = true;
  }
  if (byteOffset >= fileSize) {
    return { nextOffset: fileSize, lines: [], truncated };
  }

  let sizeNow = fileSize;
  try {
    const s2 = await stat(filePath);
    sizeNow = s2.size;
  } catch {
    return { nextOffset: byteOffset, lines: [], truncated };
  }

  if (byteOffset >= sizeNow) {
    return { nextOffset: sizeNow, lines: [], truncated };
  }

  const end = sizeNow - 1;
  if (byteOffset > end) {
    return { nextOffset: sizeNow, lines: [], truncated: true };
  }

  const lines: string[] = [];
  try {
    const stream = createReadStream(filePath, {
      start: byteOffset,
      end,
      encoding: 'utf8',
    });
    const rl = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of rl) {
      lines.push(line);
    }
  } catch {
    return { nextOffset: byteOffset, lines: [], truncated };
  }

  return { nextOffset: sizeNow, lines, truncated };
}

export async function readLastTextChunk(filePath: string, maxBytes: number): Promise<string> {
  const buf = await readFile(filePath);
  const slice = buf.subarray(Math.max(0, buf.length - maxBytes));
  return slice.toString('utf8');
}
