import nodemailer, { type Transporter } from 'nodemailer';

export interface MailerConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
  /** When true, use an in-memory JSON stream transport (for tests). */
  streamTransport?: boolean;
}

export interface SendArgs {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(args: SendArgs): Promise<{ accepted: string[]; messageId?: string }>;
}

export function createMailer(cfg: MailerConfig): Mailer {
  const transporter: Transporter = cfg.streamTransport
    ? nodemailer.createTransport({ streamTransport: true, newline: 'unix', buffer: true })
    : nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        ...(cfg.user && cfg.pass ? { auth: { user: cfg.user, pass: cfg.pass } } : {}),
      });

  return {
    async send({ to, subject, text, html }) {
      const info = await transporter.sendMail({
        from: cfg.from,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
      });
      const acceptedRaw = info.accepted as Array<string | { address: string }> | undefined;
      const accepted =
        acceptedRaw?.map((a) => (typeof a === 'string' ? a : a.address)) ??
        (Array.isArray(to) ? to : [to]);
      return { accepted, messageId: info.messageId };
    },
  };
}
