type MediaStorage = {
  read: (url: string) => Promise<Blob | undefined>;
  write: (url: string, blob: Blob) => Promise<void>;
  fetch: (url: string) => Promise<Blob>;
};
type Job = { url: string; run: () => void };

/** Shared by prefetch and the game. Public, immutable, content-addressed files only. */
export class MediaDownloads {
  private active = 0;
  private queue: Job[] = [];
  private pending = new Map<string, Promise<Blob>>();
  private urgent = new Set<string>();
  constructor(private storage: MediaStorage, private concurrency = 2) {}
  get(url: string, priority = true): Promise<Blob> {
    if (priority) this.urgent.add(url);
    const existing = this.pending.get(url);
    if (existing) {
      if (priority) {
        const index = this.queue.findIndex(job => job.url === url);
        if (index >= 0) this.queue.unshift(this.queue.splice(index, 1)[0]);
      }
      return existing;
    }
    const work = (async () => {
      const cached = await this.storage.read(url).catch(() => undefined);
      if (cached) return cached;
      return new Promise<Blob>((resolve, reject) => {
        const job = { url, run: () => {
          this.active++;
          void (async () => {
            const blob = await this.storage.fetch(url);
            // Cache denial/quota must not prevent the current session playing.
            await this.storage.write(url, blob).catch(() => {});
            return blob;
          })().then(resolve, reject).finally(() => { this.active--; this.drain(); });
        } };
        if (this.urgent.has(url)) this.queue.unshift(job); else this.queue.push(job);
        this.drain();
      });
    })();
    this.pending.set(url, work);
    const finished = () => { this.pending.delete(url); this.urgent.delete(url); };
    void work.then(finished, finished);
    return work;
  }
  private drain() {
    while (this.active < this.concurrency && this.queue.length) this.queue.shift()!.run();
  }
  async warm(urls: string[]) {
    const results = await Promise.allSettled(urls.map(url => this.get(url, false)));
    return results.every(result => result.status === "fulfilled");
  }
}

export function browserMediaDownloads() {
  // Different builds share identical hash URLs; no global "latest" alias is used.
  const cache = () => caches.open("sokudoku-media-v1");
  return new MediaDownloads({
    read: async url => (await (await cache()).match(url))?.blob(),
    write: async (url, blob) => { await (await cache()).put(url, new Response(blob)); },
    fetch: async url => {
      const response = await fetch(url, { cache: "force-cache", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw Error("MEDIA_FAILED");
      return response.blob();
    },
  });
}
