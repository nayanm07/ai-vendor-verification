import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

// Third-party keys are optional at boot so the app still runs without them;
// each integration reports a clear error when its key is missing.
export const env = {
  port: Number(process.env.PORT ?? 4010),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseUrl: required("DATABASE_URL"),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openCorporatesToken: process.env.OPENCORPORATES_API_TOKEN ?? "",
  /** auto = live if a token is set, otherwise mock */
  openCorporatesMode: (process.env.OPENCORPORATES_MODE ?? "auto") as "auto" | "live" | "mock",
  openCorporatesJurisdiction: process.env.OPENCORPORATES_JURISDICTION ?? "in",
  /** auto = Resend if a key is set, otherwise SMTP */
  emailProvider: (process.env.EMAIL_PROVIDER ?? "auto") as "auto" | "resend" | "smtp",
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Vendor Verification <onboarding@resend.dev>",
  smtpHost: process.env.SMTP_HOST ?? "localhost",
  smtpPort: Number(process.env.SMTP_PORT ?? 1026),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPass: process.env.SMTP_PASS ?? "",
};
