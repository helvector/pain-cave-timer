import { CACHE_LIMIT, cachedSource, toCache, type CacheStore } from "../mail/cache";
import type { MailSource } from "../mail/types";
import { fetchWorkoutFor, type TodayResult } from "./fetch-today";

export interface LoadResult extends TodayResult {
  /** "cache" when answered from the saved emails, "live" when the mailbox was read. */
  source: "cache" | "live";
  /** When the mailbox was read for this answer (ISO). */
  fetchedAt: string;
}

/** Saved emails older than this are not trusted even if they cover the date (a backstop for a stopped cron). */
export const MAX_CACHE_AGE_MS = 36 * 60 * 60 * 1000;

/**
 * The workout for `date`: from the saved emails when they cover it, else
 * from the mailbox. `fresh` (the Reload button) always reads the mailbox.
 * After a live read, `save` holds the cache write so the route can finish
 * it after responding.
 */
export async function loadWorkout(args: {
  date: string;
  live: () => MailSource;
  store?: CacheStore;
  fresh?: boolean;
  opts?: { ftp?: number; thr?: number };
  now?: Date;
}): Promise<LoadResult & { save?: () => Promise<void> }> {
  const { date, store, opts = {} } = args;
  const now = args.now ?? new Date();

  if (store && !args.fresh) {
    const cache = await store.read().catch(() => undefined);
    const age = cache ? now.getTime() - Date.parse(cache.fetchedAt) : Infinity;
    if (cache && age >= 0 && age < MAX_CACHE_AGE_MS) {
      const result = await fetchWorkoutFor(cachedSource(cache), date, opts);
      if (result.workout) return { ...result, source: "cache", fetchedAt: cache.fetchedAt };
    }
  }

  const messages = await args.live().latest(CACHE_LIMIT);
  const result = await fetchWorkoutFor({ latest: async (n) => messages.slice(0, n) }, date, opts);
  const cache = toCache(messages, now);
  return {
    ...result,
    source: "live",
    fetchedAt: cache.fetchedAt,
    save: store && messages.length > 0 ? () => store.write(cache) : undefined,
  };
}
