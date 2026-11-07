export const READING_INDEX_VERSION = 1;
export const normalizedReading = (kana: string) => kana.normalize("NFKC")
  .replace(/[\u30a1-\u30f6]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
  .replace(/\s+/g, "");

export function readingDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length < b.length) [a, b] = [b, a];
  let row = new Uint16Array(b.length + 1), next = new Uint16Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) row[j] = j;
  for (let i = 0; i < a.length; i++) {
    next[0] = i + 1;
    for (let j = 0; j < b.length; j++)
      next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1));
    [row, next] = [next, row];
  }
  return row[b.length];
}
type Node = { reading: string; children: Record<number, number> };
export type ReadingIndex = { version: number; total: number; maxLength: number; buckets: Record<number, Node[]> };
export function emptyReadingIndex(): ReadingIndex {
  return { version: READING_INDEX_VERSION, total: 0, maxLength: 0, buckets: {} };
}
export function addReading(index: ReadingIndex, reading: string) {
  if (!reading) return;
  const nodes = index.buckets[reading.length] ??= [];
  if (!nodes.length) nodes.push({ reading, children: {} });
  else {
    let at = 0;
    for (;;) {
      const d = readingDistance(reading, nodes[at].reading);
      if (!d) return;
      const child = nodes[at].children[d];
      if (child === undefined) {
        nodes[at].children[d] = nodes.length;
        nodes.push({ reading, children: {} });
        break;
      }
      at = child;
    }
  }
  index.total++;
  index.maxLength = Math.max(index.maxLength, reading.length);
}
export function buildReadingIndex(readings: string[]): ReadingIndex {
  const index = emptyReadingIndex();
  for (const reading of new Set(readings.map(normalizedReading))) addReading(index, reading);
  return index;
}
/** Compare the complete normalized content, not a collision-prone short hash. */
export const readingSignature = (readings: string[]) => JSON.stringify([...new Set(readings.map(normalizedReading).filter(Boolean))].sort());

function within(index: ReadingIndex, target: string, radius: number, found: Map<string, number>) {
  for (let length = Math.max(1, target.length - radius); length <= Math.min(index.maxLength, target.length + radius); length++) {
    const nodes = index.buckets[length];
    if (!nodes?.length) continue;
    const stack = [0];
    while (stack.length) {
      const node = nodes[stack.pop()!], distance = readingDistance(target, node.reading);
      if (distance && distance <= radius)
        found.set(node.reading, distance + Math.abs(length - target.length) * 0.25);
      for (let d = Math.max(1, distance - radius); d <= distance + radius; d++)
        if (node.children[d] !== undefined) stack.push(node.children[d]);
    }
  }
}
/** BK-tree pruning uses plain edit distance; length penalties only rank results. */
export function searchReadings(indexes: ReadingIndex[], kana: string, limit = 20): string[] {
  const target = normalizedReading(kana);
  if (!target || limit < 1) return [];
  const maximum = Math.max(target.length, ...indexes.map((index) => index.maxLength));
  let radius = 1;
  for (;;) {
    const found = new Map<string, number>();
    for (const index of indexes) within(index, target, radius, found);
    const sorted = [...found].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    // An unseen distance > radius must not outrank the last retained result.
    if (radius >= maximum || (sorted.length >= limit && sorted[limit - 1][1] < radius + 1))
      return sorted.slice(0, limit).map(([reading]) => reading);
    radius = Math.min(maximum, sorted.length >= limit ? Math.max(radius + 1, Math.ceil(sorted[limit - 1][1])) : radius * 2);
  }
}
