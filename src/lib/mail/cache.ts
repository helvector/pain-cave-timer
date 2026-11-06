import { get, put } from "@vercel/blob";
import type { MailMessage, MailSource } from "./types";

/**
 * A saved copy of the newest workout emails, so a page load doesn't have to
 * open the mailbox. The cron route fills it after the nightly email lands;
 * the workout route reads it and falls back to IMAP when it can't answer.
 *
 * It holds the emails themselves, not parsed workouts: parsing takes
 * milliseconds, and keeping the raw HTML means a parser change or a new
 * FTP/THR setting applies straight away without refetching.
 */
export interface MailCache {
  version: 1;
  /** When the mailbox was last read (ISO). */
  fetchedAt: string;
  messages: Array<Omit<MailMessage, "receivedAt"> & { receivedAt: string }>;
}

export interface CacheStore {
  read(): Promise<MailCache | undefined>;
  write(cache: MailCache): Promise<void>;
}

/** How many emails to keep: today, tomorrow and yesterday with room for a missed night. */
export const CACHE_LIMIT = 5;

export function toCache(messages: MailMessage[], fetchedAt: Date): MailCache {
  return {
    version: 1,
    fetchedAt: fetchedAt.toISOString(),
    messages: messages.slice(0, CACHE_LIMIT).map((m) => ({ ...m, receivedAt: m.receivedAt.toISOString() })),
  };
}

/** A MailSource that answers from saved emails. */
export function cachedSource(cache: MailCache): MailSource {
  const messages = cache.messages.map((m) => ({ ...m, receivedAt: new Date(m.receivedAt) }));
  return { latest: async (limit) => messages.slice(0, limit) };
}

/** Read the mailbox and save what came back. Used by the cron route. */
export async function refreshCache(source: MailSource, store: CacheStore, now = new Date()): Promise<MailCache> {
  const cache = toCache(await source.latest(CACHE_LIMIT), now);
  await store.write(cache);
  return cache;
}

/**
 * The private Blob store already used for settings. One file per Vercel
 * environment: the store is shared by Production, Preview and Development,
 * and a preview must never overwrite what production reads.
 */
export function blobCacheStore(env: Record<string, string | undefined> = process.env): CacheStore | undefined {
  if (!env.BLOB_READ_WRITE_TOKEN) return undefined;
  const path = `mail-cache/${env.VERCEL_ENV || "development"}.json`;
  return {
    async read() {
      const res = await get(path, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return undefined;
      const parsed = JSON.parse(await new Response(res.stream).text()) as MailCache;
      return parsed?.version === 1 && Array.isArray(parsed.messages) ? parsed : undefined;
    },
    async write(cache) {
      await put(path, JSON.stringify(cache), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 60,
      });
    },
  };
}
