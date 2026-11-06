import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { blobCacheStore, refreshCache, toCache, type CacheStore, type MailCache } from "../src/lib/mail/cache";
import type { MailMessage, MailSource } from "../src/lib/mail/types";
import { loadWorkout, MAX_CACHE_AGE_MS } from "../src/lib/workout/load";

// Covers Thu 09/10 and Fri 09/11.
const html = readFileSync("fixtures/trainingpeaks-sweet-spot-3x15.html", "utf8");
const email: MailMessage = {
  id: "uid:1",
  subject: "Schedule for Thursday 09/10/2026 to Friday 09/11/2026",
  from: "x",
  receivedAt: new Date("2026-09-09T21:21:11Z"),
  html,
};
const NOW = new Date("2026-09-10T15:00:00Z");

function memoryStore(initial?: MailCache): CacheStore & { saved?: MailCache; writes: number } {
  const s = {
    saved: initial,
    writes: 0,
    async read() { return s.saved; },
    async write(c: MailCache) { s.saved = c; s.writes++; },
  };
  return s;
}

function mailbox(messages: MailMessage[]): { live: () => MailSource; opens: () => number } {
  let n = 0;
  return { live: () => { n++; return { latest: async (limit) => messages.slice(0, limit) }; }, opens: () => n };
}

describe("loadWorkout", () => {
  it("answers from the saved emails without opening the mailbox", async () => {
    const store = memoryStore(toCache([email], new Date("2026-09-09T21:40:00Z")));
    const box = mailbox([]);
    const r = await loadWorkout({ date: "2026-09-10", live: box.live, store, now: NOW });
    expect(r.source).toBe("cache");
    expect(r.fetchedAt).toBe("2026-09-09T21:40:00.000Z");
    expect(r.workout?.date).toBe("2026-09-10");
    expect(r.email?.receivedAt).toBe("2026-09-09T21:21:11.000Z");
    expect(box.opens()).toBe(0);
    expect(r.save).toBeUndefined();
  });

  it("reads the mailbox when the saved emails don't cover the date, and saves them", async () => {
    const store = memoryStore(toCache([email], new Date("2026-09-09T21:40:00Z")));
    const box = mailbox([email]);
    const r = await loadWorkout({ date: "2026-09-12", live: box.live, store, now: NOW });
    expect(r.source).toBe("live");
    expect(box.opens()).toBe(1);
    await r.save?.();
    expect(store.writes).toBe(1);
    expect(store.saved?.fetchedAt).toBe(NOW.toISOString());
  });

  it("fresh (Reload) always reads the mailbox", async () => {
    const store = memoryStore(toCache([email], new Date("2026-09-09T21:40:00Z")));
    const box = mailbox([email]);
    const r = await loadWorkout({ date: "2026-09-10", live: box.live, store, fresh: true, now: NOW });
    expect(r.source).toBe("live");
    expect(r.workout?.date).toBe("2026-09-10");
    expect(box.opens()).toBe(1);
  });

  it("doesn't trust a copy older than the age cap", async () => {
    const store = memoryStore(toCache([email], new Date(NOW.getTime() - MAX_CACHE_AGE_MS - 1)));
    const box = mailbox([email]);
    const r = await loadWorkout({ date: "2026-09-10", live: box.live, store, now: NOW });
    expect(r.source).toBe("live");
  });

  it("falls back to the mailbox when the store can't be read", async () => {
    const store: CacheStore = { read: async () => { throw new Error("blob down"); }, write: async () => {} };
    const box = mailbox([email]);
    const r = await loadWorkout({ date: "2026-09-10", live: box.live, store, now: NOW });
    expect(r.source).toBe("live");
    expect(r.workout?.date).toBe("2026-09-10");
  });

  it("works with no store at all (local dev without Blob)", async () => {
    const box = mailbox([email]);
    const r = await loadWorkout({ date: "2026-09-10", live: box.live, now: NOW });
    expect(r.source).toBe("live");
    expect(r.save).toBeUndefined();
  });

  it("gives the same answer from the cache as from the mailbox", async () => {
    const live = await loadWorkout({ date: "2026-09-10", live: mailbox([email]).live, now: NOW });
    const cached = await loadWorkout({ date: "2026-09-10", live: mailbox([]).live, store: memoryStore(toCache([email], NOW)), now: NOW });
    expect(cached.workout).toEqual(live.workout);
    expect(cached.days).toEqual(live.days);
  });
});

describe("refreshCache", () => {
  it("saves the newest emails with a timestamp", async () => {
    const store = memoryStore();
    const c = await refreshCache({ latest: async () => [email] }, store, NOW);
    expect(store.saved).toEqual(c);
    expect(c.fetchedAt).toBe(NOW.toISOString());
    expect(c.messages[0].receivedAt).toBe("2026-09-09T21:21:11.000Z");
  });
});

describe("blobCacheStore", () => {
  it("is off without a Blob token", () => {
    expect(blobCacheStore({})).toBeUndefined();
  });
});

describe("GET /api/cron/refresh", () => {
  const call = async (env: Record<string, string>, auth?: string) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try {
      const { GET } = await import("../src/app/api/cron/refresh/route");
      const { NextRequest } = await import("next/server");
      return await GET(new NextRequest("http://localhost/api/cron/refresh", { headers: auth ? { authorization: auth } : {} }));
    } finally {
      for (const k of Object.keys(env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  };
  it("refuses without CRON_SECRET configured", async () => {
    delete process.env.CRON_SECRET;
    expect((await call({}, "Bearer anything")).status).toBe(500);
  });
  it("refuses a wrong secret", async () => {
    expect((await call({ CRON_SECRET: "right" }, "Bearer wrong")).status).toBe(401);
    expect((await call({ CRON_SECRET: "right" })).status).toBe(401);
  });
});
