/**
 * Where workout emails come from. The IMAP implementation is the next step;
 * it reads MAIL_* from environment variables and is never configured in code.
 */
export interface MailMessage {
  id: string;
  subject: string;
  from: string;
  receivedAt: Date;
  html: string;
}

export interface MailSource {
  /** Most recent messages from the configured sender, newest first. */
  latest(limit: number): Promise<MailMessage[]>;
}
