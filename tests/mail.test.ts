import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mailConfigFromEnv, toMailMessage } from "../src/lib/mail";
import { normaliseAppPassword } from "../src/lib/mail/env";
import { fetchWorkoutFor } from "../src/lib/workout/fetch-today";
import type { MailMessage, MailSource } from "../src/lib/mail/types";

const html = readFileSync("fixtures/trainingpeaks-sweet-spot-3x15.html", "utf8");

function mime(opts: { subject: string; html?: string; text?: string; date?: string }): string {
  const boundary = "b0undary";
  const parts: string[] = [];
  if (opts.text) parts.push(`--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${opts.text}\r\n`);
  if (opts.html) parts.push(`--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n${opts.html}\r\n`);
  return [
    "From: TrainingPeaks <messages-no-reply@trainingpeaks.com>",
    "To: rider@example.com",
    `Subject: ${opts.subject}`,
    `Date: ${opts.date ?? "Wed, 09 Sep 2026 21:21:11 +0000"}`,
    "Message-ID: <abc@trainingpeaks.com>",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    ...parts,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

describe("toMailMessage", () => {
  it("extracts headers and the HTML part", async () => {
    const m = await toMailMessage(mime({ subject: "Schedule for Thursday 09/10/2026 to Friday 09/11/2026", text: "plain", html }), { id: "uid:1" });
    expect(m.id).toBe("<abc@trainingpeaks.com>");
    expect(m.from).toBe("messages-no-reply@trainingpeaks.com");
    expect(m.subject).toMatch(/^Schedule for/);
    expect(m.receivedAt.toISOString()).toBe("2026-09-09T21:21:11.000Z");
    expect(m.html).toContain("structureTitle");
  });
  it("falls back to text when there is no HTML", async () => {
    const m = await toMailMessage(mime({ subject: "fwd", text: "10 min @ 200 W <ok>" }), { id: "uid:2", receivedAt: new Date(0) });
    expect(m.html).toBe("<pre>10 min @ 200 W &lt;ok&gt;</pre>");
  });
});

describe("mailConfigFromEnv", () => {
  const base = { MAIL_HOST: "imap.example.com", MAIL_USER: "u", MAIL_PASSWORD: "p" };
  it("reads with defaults", () => {
    expect(mailConfigFromEnv(base)).toEqual({
      host: "imap.example.com", port: 993, secure: true, user: "u", password: "p",
      from: "messages-no-reply@trainingpeaks.com", folder: "INBOX",
    });
  });
  it("strips the display spaces from a Google App Password", () => {
    expect(normaliseAppPassword("abcd efgh ijkl mnop")).toBe("abcdefghijklmnop");
    expect(normaliseAppPassword("abcdefghijklmnop")).toBe("abcdefghijklmnop");
    expect(normaliseAppPassword("my real pass word")).toBe("my real pass word");
    expect(mailConfigFromEnv({ ...base, MAIL_PASSWORD: "abcd efgh ijkl mnop" }).password).toBe("abcdefghijklmnop");
  });
  it("fails loudly when a credential is missing", () => {
    expect(() => mailConfigFromEnv({ MAIL_HOST: "h", MAIL_USER: "u" })).toThrow(/MAIL_PASSWORD/);
    expect(() => mailConfigFromEnv({ ...base, MAIL_PORT: "abc" })).toThrow(/MAIL_PORT/);
  });
});

describe("fetchWorkoutFor", () => {
  const msg = (subject: string, receivedAt: string, body = html): MailMessage => ({ id: subject, subject, from: "x", receivedAt: new Date(receivedAt), html: body });
  const olderHtml = html.replace("September 10", "September 3").replace("September 11", "September 4");
  const source: MailSource = {
    async latest() {
      return [
        msg("Schedule for Thursday 09/10/2026 to Friday 09/11/2026", "2026-09-09T21:21:11Z"),
        msg("Schedule for Thursday 09/03/2026 to Friday 09/04/2026", "2026-09-02T21:21:11Z", olderHtml),
      ];
    },
  };
  it("returns the workout for the date from the newest matching email", async () => {
    const r = await fetchWorkoutFor(source, "2026-09-10");
    expect(r.workout?.title).toMatch(/Sweet Spot/);
    expect(r.email?.subject).toMatch(/09\/10\/2026/);
    expect(r.days).toHaveLength(2);
  });
  it("falls through to an older email", async () => {
    const r = await fetchWorkoutFor(source, "2026-09-04");
    expect(r.workout?.isRestDay).toBe(true);
    expect(r.days).toHaveLength(4);
  });
  it("adds yesterday from the email before, keeping the newest copy of today", async () => {
    const dayBefore = html.replace("September 10", "September 9").replace("September 11", "September 10");
    const r = await fetchWorkoutFor({
      async latest() {
        return [
          msg("Schedule for Thursday 09/10/2026 to Friday 09/11/2026", "2026-09-09T21:21:11Z"),
          msg("Schedule for Wednesday 09/09/2026 to Thursday 09/10/2026", "2026-09-08T21:21:11Z", dayBefore),
          msg("Schedule for Thursday 09/03/2026 to Friday 09/04/2026", "2026-09-02T21:21:11Z", olderHtml),
        ];
      },
    }, "2026-09-10");
    expect(r.days.map((d) => d.date).sort()).toEqual(["2026-09-09", "2026-09-10", "2026-09-11"]);
    expect(r.days.find((d) => d.date === "2026-09-10")).toBe(r.workout);
    expect(r.workout?.title).toMatch(/Sweet Spot/);
  });
  it("reports when nothing matches", async () => {
    const r = await fetchWorkoutFor(source, "2026-09-20");
    expect(r.workout).toBeUndefined();
    expect(r.warnings.join(" ")).toMatch(/No workout scheduled for 2026-09-20/);
  });
  it("reports an empty mailbox", async () => {
    const r = await fetchWorkoutFor({ latest: async () => [] }, "2026-09-10");
    expect(r.warnings.join(" ")).toMatch(/No workout emails/);
  });
});
