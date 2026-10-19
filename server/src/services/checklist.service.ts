import type { DocType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getVendor } from "./vendor.service.js";
import { DOC_TYPES, EXPECTED_FIELDS } from "./document.service.js";

export type ChecklistStatus = "MISSING" | "AVAILABLE" | "VERIFIED";

export const DOC_LABELS: Record<DocType, string> = {
  REGISTRATION: "Company Registration Certificate",
  GST: "GST / Tax Certificate",
  BANK: "Bank Document",
};

const FIELD_LABELS: Record<string, string> = {
  companyName: "Company Name",
  regNumber: "Registration Number",
  gstNumber: "GST / Tax Number",
  address: "Address",
  bankAccount: "Bank Account Number",
  ifsc: "IFSC Code",
};
const fieldLabel = (f: string) => FIELD_LABELS[f] ?? f;

type ComparisonResult = { fields: { field: string; status: string }[] };

/**
 * MISSING   – not uploaded
 * AVAILABLE – uploaded, but not (yet) confirmed by an up-to-date AI comparison
 * VERIFIED  – extracted, and the latest comparison (run after the last upload/edit) found
 *             every field this document should carry present and consistent
 */
export async function getChecklist(vendorId: string) {
  await getVendor(vendorId);
  const [docs, comparison, emails] = await Promise.all([
    prisma.document.findMany({ where: { vendorId } }),
    prisma.comparison.findFirst({ where: { vendorId }, orderBy: { createdAt: "desc" } }),
    prisma.emailLog.findMany({ where: { vendorId, status: "SENT" }, orderBy: { sentAt: "desc" } }),
  ]);

  const fieldStatus = new Map(((comparison?.result as ComparisonResult | null)?.fields ?? []).map((f) => [f.field, f.status]));

  return DOC_TYPES.map((docType) => {
    const doc = docs.find((d) => d.docType === docType);
    const lastEmail = emails.find((e) => e.missingDoc === docType);
    let status: ChecklistStatus = "MISSING";
    let reason = "Not uploaded";

    if (doc) {
      status = "AVAILABLE";
      reason = "Uploaded";
      const lastChange = doc.editedAt && doc.editedAt > doc.uploadedAt ? doc.editedAt : doc.uploadedAt;
      const data = (doc.extractedData ?? {}) as Record<string, string | null>;
      if (doc.extractionStatus !== "EXTRACTED") {
        reason = doc.extractionStatus === "FAILED" ? "AI extraction failed" : "Awaiting extraction";
      } else if (!comparison || comparison.createdAt < lastChange) {
        reason = "Run AI comparison to verify";
      } else {
        const problems = EXPECTED_FIELDS[docType].filter((f) => !data[f] || fieldStatus.get(f) === "MISMATCH");
        if (problems.length === 0) {
          status = "VERIFIED";
          reason = "All fields consistent across sources";
        } else {
          reason = `Issues with: ${problems.map(fieldLabel).join(", ")}`;
        }
      }
    }

    return {
      docType,
      label: DOC_LABELS[docType],
      status,
      reason,
      documentId: doc?.id ?? null,
      lastReminderAt: lastEmail?.sentAt ?? null,
    };
  });
}
