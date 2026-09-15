import { simpleParser } from "mailparser";
import type { MailMessage } from "./types";

/**
 * Turn a raw RFC 822 message into the shape the parser wants. Pure apart
 * from mailparser, so it is unit-tested with a synthetic MIME message.
 * Falls back to the plain-text part wrapped in <pre> when there is no HTML,
 * so a text-only forward still reaches the parser (and shows as unparsed
 * rather than vanishing).
 */
export async function toMailMessage(source: Buffer | string, fallback: { id: string; receivedAt?: Date }): Promise<MailMessage> {
  const parsed = await simpleParser(source);
  const html = parsed.html || (parsed.text ? `<pre>${escapeHtml(parsed.text.trim())}</pre>` : "");
  return {
    id: parsed.messageId ?? fallback.id,
    subject: parsed.subject ?? "",
    from: parsed.from?.value?.[0]?.address ?? "",
    receivedAt: parsed.date ?? fallback.receivedAt ?? new Date(0),
    html,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
