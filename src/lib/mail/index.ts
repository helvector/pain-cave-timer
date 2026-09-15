export type { MailMessage, MailSource } from "./types";
export { mailConfigFromEnv, type MailConfig } from "./env";
export { createImapSource } from "./imap";
export { toMailMessage } from "./message";
