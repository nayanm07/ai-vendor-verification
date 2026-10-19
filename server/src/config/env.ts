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
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "Vendor Verification <onboarding@resend.dev>",
};
