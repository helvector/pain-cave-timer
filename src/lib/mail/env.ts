/**
 * Mail configuration comes ONLY from environment variables (Vercel project
 * settings in production, `.env.local` locally). Nothing here has defaults
 * for credentials, so a misconfigured deploy fails loudly, not silently.
 */
export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  /** Only messages from this address count as workout emails. */
  from: string;
  folder: string;
}

export function mailConfigFromEnv(env: Record<string, string | undefined> = process.env): MailConfig {
  const required = (name: string): string => {
    const v = env[name]?.trim();
    if (!v) throw new Error(`Missing environment variable ${name}`);
    return v;
  };
  const port = Number(env.MAIL_PORT ?? 993);
  if (!Number.isInteger(port) || port <= 0) throw new Error("MAIL_PORT must be a positive integer");
  return {
    host: required("MAIL_HOST"),
    port,
    secure: (env.MAIL_SECURE ?? "true").toLowerCase() !== "false",
    user: required("MAIL_USER"),
    password: required("MAIL_PASSWORD"),
    from: env.MAIL_FROM?.trim() || "messages-no-reply@trainingpeaks.com",
    folder: env.MAIL_FOLDER?.trim() || "INBOX",
  };
}
