import { ImapFlow } from "imapflow";
import type { MailConfig } from "./env";
import { toMailMessage } from "./message";
import type { MailMessage, MailSource } from "./types";

/**
 * IMAP-backed MailSource. One short-lived connection per call: the app
 * fetches at most a few times a day, and Vercel functions should not hold
 * sockets open between invocations.
 */
export function createImapSource(config: MailConfig): MailSource {
  return {
    async latest(limit: number): Promise<MailMessage[]> {
      const client = new ImapFlow({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: { user: config.user, pass: config.password },
        logger: false,
      });

      await client.connect();
      try {
        const lock = await client.getMailboxLock(config.folder);
        try {
          const uids = await client.search({ from: config.from }, { uid: true });
          if (!uids || uids.length === 0) return [];
          // UIDs are assigned in arrival order; take the newest few.
          const wanted = uids.sort((a, b) => a - b).slice(-limit);
          const out: MailMessage[] = [];
          for await (const msg of client.fetch(wanted, { uid: true, source: true, internalDate: true }, { uid: true })) {
            if (!msg.source) continue;
            const receivedAt = msg.internalDate ? new Date(msg.internalDate) : undefined;
            out.push(await toMailMessage(msg.source, { id: `uid:${msg.uid}`, receivedAt }));
          }
          return out.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
        } finally {
          lock.release();
        }
      } finally {
        await client.logout().catch(() => undefined);
      }
    },
  };
}
