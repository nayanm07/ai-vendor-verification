import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "../config/env.js";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProvider {
  readonly name: "resend" | "smtp";
  send(msg: EmailMessage): Promise<{ id: string | null }>;
}

class ResendProvider implements EmailProvider {
  readonly name = "resend" as const;
  private client = new Resend(env.resendApiKey);

  async send(msg: EmailMessage) {
    const { data, error } = await this.client.emails.send({ from: env.emailFrom, ...msg });
    if (error) throw new Error(`Resend: ${error.message}`);
    return { id: data?.id ?? null };
  }
}

/** Plain SMTP — in development this points at the Mailpit container (web inbox on :8026). */
class SmtpProvider implements EmailProvider {
  readonly name = "smtp" as const;
  private transport = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    connectionTimeout: 10_000,
  });

  async send(msg: EmailMessage) {
    try {
      const info = await this.transport.sendMail({ from: env.emailFrom, ...msg });
      return { id: info.messageId ?? null };
    } catch (err) {
      throw new Error(`SMTP (${env.smtpHost}:${env.smtpPort}): ${err instanceof Error ? err.message : "send failed"}`);
    }
  }
}

/** Resend when an API key is configured (unless forced), otherwise SMTP. */
export const emailProvider: EmailProvider =
  env.emailProvider === "resend" || (env.emailProvider === "auto" && env.resendApiKey)
    ? new ResendProvider()
    : new SmtpProvider();
