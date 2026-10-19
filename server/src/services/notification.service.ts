import type { DocType, Vendor } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { emailProvider } from "../integrations/email.js";
import { DOC_LABELS } from "./checklist.service.js";

/** Don't re-send the same missing-document reminder more often than this (unless forced). */
const REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildMissingDocsEmail(vendor: Vendor, missing: DocType[]) {
  const labels = missing.map((d) => DOC_LABELS[d]);
  const subject = `Action required: ${labels.length === 1 ? labels[0] : "documents"} missing for ${vendor.companyName}`;
  const text = [
    `Dear ${vendor.contactPerson},`,
    "",
    `We are completing the vendor verification for ${vendor.companyName}. The following document(s) are missing:`,
    "",
    ...labels.map((l) => `  - ${l}`),
    "",
    "Please provide the above document(s) at your earliest convenience by replying to this email with the files attached.",
    "",
    "Thank you,",
    "Vendor Onboarding Team",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #1d2330; max-width: 560px">
      <p>Dear ${escapeHtml(vendor.contactPerson)},</p>
      <p>We are completing the vendor verification for <strong>${escapeHtml(vendor.companyName)}</strong>.
         The following document(s) are missing:</p>
      <ul>${labels.map((l) => `<li><strong>${escapeHtml(l)}</strong></li>`).join("")}</ul>
      <p>Please provide the above document(s) at your earliest convenience by replying to this email with the files attached.</p>
      <p>Thank you,<br/>Vendor Onboarding Team</p>
    </div>`;
  return { subject, text, html };
}

/**
 * Emails the vendor's registered address about missing documents and logs one EmailLog row per document.
 * Documents reminded within the cooldown window are skipped unless `force` is set.
 */
export async function notifyMissingDocuments(vendor: Vendor, missing: DocType[], { force = false } = {}) {
  if (missing.length === 0) return { sent: [] as DocType[], skipped: [] as DocType[], error: null };

  const since = new Date(Date.now() - REMINDER_COOLDOWN_MS);
  const recent = force
    ? []
    : await prisma.emailLog.findMany({
        where: { vendorId: vendor.id, status: "SENT", missingDoc: { in: missing }, sentAt: { gte: since } },
      });
  const skipped = missing.filter((d) => recent.some((r) => r.missingDoc === d));
  const toSend = missing.filter((d) => !skipped.includes(d));
  if (toSend.length === 0) return { sent: [], skipped, error: null };

  const { subject, text, html } = buildMissingDocsEmail(vendor, toSend);
  let providerId: string | null = null;
  let error: string | null = null;
  try {
    ({ id: providerId } = await emailProvider.send({ to: vendor.email, subject, text, html }));
  } catch (err) {
    error = err instanceof Error ? err.message : "Email send failed";
    console.error("Missing-document email failed:", error);
  }

  await prisma.emailLog.createMany({
    data: toSend.map((missingDoc) => ({
      vendorId: vendor.id,
      toEmail: vendor.email,
      subject,
      missingDoc,
      status: error ? "FAILED" : "SENT",
      providerId: providerId ? `${emailProvider.name}:${providerId}` : null,
      error,
    })),
  });

  return { sent: error ? [] : toSend, skipped, error };
}

export function listEmailLogs(vendorId: string) {
  return prisma.emailLog.findMany({ where: { vendorId }, orderBy: { sentAt: "desc" } });
}
