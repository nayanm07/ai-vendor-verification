import type { DocType, TaskPriority, VendorStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { badRequest } from "../utils/httpError.js";
import { getVendor } from "./vendor.service.js";
import { getChecklist, DOC_LABELS } from "./checklist.service.js";
import { notifyMissingDocuments } from "./notification.service.js";
import { compareVendor } from "./document.service.js";
import { verifyVendor } from "./verification.service.js";
import { HttpError } from "../utils/httpError.js";

/**
 * Draft → Under Review → Action Required → Approved / Rejected
 * Approval is only possible from Under Review, i.e. once no open issues remain.
 */
const TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  DRAFT: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["ACTION_REQUIRED", "APPROVED", "REJECTED", "DRAFT"],
  ACTION_REQUIRED: ["UNDER_REVIEW", "REJECTED"],
  APPROVED: ["UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"],
};

/** Statuses in which the automation actively monitors the vendor. */
const MONITORED: VendorStatus[] = ["UNDER_REVIEW", "ACTION_REQUIRED"];

const STATUS_LABELS: Record<VendorStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under Review",
  ACTION_REQUIRED: "Action Required",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function allowedTransitions(status: VendorStatus) {
  return TRANSITIONS[status];
}

export function logActivity(vendorId: string, type: string, message: string, actor = "system") {
  return prisma.activity.create({ data: { vendorId, type, message, actor } });
}

async function setStatus(vendorId: string, from: VendorStatus, to: VendorStatus, actor: string, reason?: string) {
  await prisma.vendor.update({ where: { id: vendorId }, data: { status: to } });
  await logActivity(
    vendorId,
    "STATUS_CHANGE",
    `${STATUS_LABELS[from]} → ${STATUS_LABELS[to]}${reason ? ` (${reason})` : ""}`,
    actor,
  );
}

/** Manual status change by a reviewer. Entering review triggers the automated checks. */
export async function changeStatus(vendorId: string, to: VendorStatus) {
  const vendor = await getVendor(vendorId);
  if (vendor.status === to) throw badRequest(`Vendor is already ${STATUS_LABELS[to]}`);
  if (!TRANSITIONS[vendor.status].includes(to)) {
    throw badRequest(
      `Cannot move from ${STATUS_LABELS[vendor.status]} to ${STATUS_LABELS[to]}` +
        (to === "APPROVED" && vendor.status === "ACTION_REQUIRED" ? " — resolve open issues first" : ""),
    );
  }
  if (to === "APPROVED") {
    const pending = await prisma.task.count({ where: { vendorId, status: "PENDING" } });
    if (pending > 0) throw badRequest(`Cannot approve: ${pending} task(s) still pending`);
  }

  await setStatus(vendorId, vendor.status, to, "reviewer");
  const evaluation = MONITORED.includes(to) ? await evaluateVendor(vendorId) : null;
  return { vendor: await getVendor(vendorId), evaluation };
}

// ---------------------------------------------------------------- automation

type Issue = { key: string; title: string; description: string; priority: TaskPriority; dueInDays: number };

const addDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const FIELD_LABELS: Record<string, string> = {
  companyName: "Company Name",
  regNumber: "Registration Number",
  gstNumber: "GST / Tax Number",
  address: "Address",
  bankAccount: "Bank Account Number",
  ifsc: "IFSC Code",
  status: "Company Status",
};
const label = (f: string) => FIELD_LABELS[f] ?? f;

/** Derives the current list of blocking issues from the latest checklist, comparison and verification. */
async function collectIssues(vendorId: string) {
  const [checklist, comparison, verification] = await Promise.all([
    getChecklist(vendorId),
    prisma.comparison.findFirst({ where: { vendorId }, orderBy: { createdAt: "desc" } }),
    prisma.verification.findFirst({ where: { vendorId }, orderBy: { createdAt: "desc" } }),
  ]);

  const issues: Issue[] = [];
  const missingDocs = checklist.filter((c) => c.status === "MISSING").map((c) => c.docType as DocType);

  for (const doc of missingDocs) {
    issues.push({
      key: `missing:${doc}`,
      title: `Obtain missing ${DOC_LABELS[doc]}`,
      description: `${DOC_LABELS[doc]} has not been provided. The vendor has been emailed a request.`,
      priority: "HIGH",
      dueInDays: 3,
    });
  }

  const compFields = (comparison?.result as { fields?: { field: string; status: string; note: string }[] } | null)?.fields ?? [];
  for (const f of compFields.filter((f) => f.status === "MISMATCH")) {
    issues.push({
      key: `mismatch:documents:${f.field}`,
      title: `Resolve document mismatch: ${label(f.field)}`,
      description: f.note,
      priority: "MEDIUM",
      dueInDays: 2,
    });
  }

  if (verification?.result === "MISMATCH") {
    const fields = (verification.details as { mismatches?: string[] } | null)?.mismatches ?? [];
    issues.push({
      key: "mismatch:registry",
      title: "Resolve company registry mismatch",
      description: `Registry record differs from vendor details on: ${fields.map(label).join(", ")}.`,
      priority: "HIGH",
      dueInDays: 2,
    });
  } else if (verification?.result === "UNABLE_TO_VERIFY") {
    issues.push({
      key: "verify:manual",
      title: "Manually verify company registration",
      description: `Automatic registry verification failed: ${verification.error ?? "unknown reason"}.`,
      priority: "MEDIUM",
      dueInDays: 3,
    });
  }

  return { issues, missingDocs };
}

/**
 * Serialises evaluations per vendor. Evaluation is check-then-act (find open tasks, then create;
 * find recent emails, then send), so two triggers landing together — e.g. an upload and a
 * comparison — could otherwise both create the same task or send the same email.
 * In-process only: running several API instances would need a DB-level lock (pg_advisory_xact_lock).
 */
const evaluationQueues = new Map<string, Promise<unknown>>();

function withVendorLock<T>(vendorId: string, fn: () => Promise<T>): Promise<T> {
  const previous = evaluationQueues.get(vendorId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(fn);
  const tail = run.catch(() => {});
  evaluationQueues.set(vendorId, tail);
  void tail.then(() => {
    if (evaluationQueues.get(vendorId) === tail) evaluationQueues.delete(vendorId);
  });
  return run;
}

/**
 * Re-evaluates a vendor under review:
 *  - emails the vendor about missing documents (deduplicated),
 *  - opens a task per new issue and auto-completes tasks whose issue has been resolved,
 *  - moves Under Review ⇄ Action Required accordingly.
 * No-op for Draft / Approved / Rejected vendors.
 */
export function evaluateVendor(vendorId: string) {
  return withVendorLock(vendorId, () => evaluateVendorNow(vendorId));
}

async function evaluateVendorNow(vendorId: string) {
  const vendor = await getVendor(vendorId);
  if (!MONITORED.includes(vendor.status)) return null;

  const { issues, missingDocs } = await collectIssues(vendorId);

  // 1. Missing-document emails
  const email = await notifyMissingDocuments(vendor, missingDocs);
  if (email.sent.length) {
    await logActivity(vendorId, "EMAIL", `Requested ${email.sent.map((d) => DOC_LABELS[d]).join(", ")} from ${vendor.email}`);
  }
  if (email.error) await logActivity(vendorId, "EMAIL", `Failed to email ${vendor.email}: ${email.error}`);

  // 2. Tasks: open new, close resolved (only auto-created ones, identified by sourceKey)
  const openAuto = await prisma.task.findMany({ where: { vendorId, status: "PENDING", sourceKey: { not: null } } });
  const created: string[] = [];
  for (const issue of issues) {
    if (openAuto.some((t) => t.sourceKey === issue.key)) continue;
    await prisma.task.create({
      data: {
        vendorId,
        title: issue.title,
        description: issue.description,
        priority: issue.priority,
        dueDate: addDays(issue.dueInDays),
        sourceKey: issue.key,
      },
    });
    created.push(issue.title);
  }
  const resolved = openAuto.filter((t) => !issues.some((i) => i.key === t.sourceKey));
  if (resolved.length) {
    await prisma.task.updateMany({
      where: { id: { in: resolved.map((t) => t.id) } },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  }
  for (const title of created) await logActivity(vendorId, "TASK", `Task created: ${title}`);
  for (const t of resolved) await logActivity(vendorId, "TASK", `Task auto-completed (issue resolved): ${t.title}`);

  // 3. Status
  let status = vendor.status;
  if (issues.length > 0 && status === "UNDER_REVIEW") {
    await setStatus(vendorId, status, "ACTION_REQUIRED", "system", `${issues.length} issue(s) found`);
    status = "ACTION_REQUIRED";
  } else if (issues.length === 0 && status === "ACTION_REQUIRED") {
    await setStatus(vendorId, status, "UNDER_REVIEW", "system", "all issues resolved");
    status = "UNDER_REVIEW";
  }

  return {
    status,
    issues: issues.map(({ key, title, priority }) => ({ key, title, priority })),
    emailsSent: email.sent,
    emailError: email.error,
    tasksCreated: created.length,
    tasksResolved: resolved.length,
  };
}

/** Runs AI comparison + registry verification, then evaluates — the full automated pipeline. */
export async function runAllChecks(vendorId: string) {
  const steps: { step: string; ok: boolean; message: string }[] = [];

  try {
    const c = await compareVendor(vendorId);
    steps.push({ step: "AI comparison", ok: true, message: c.hasMismatch ? "Mismatch found" : "No mismatches" });
  } catch (err) {
    steps.push({ step: "AI comparison", ok: false, message: err instanceof HttpError ? err.message : "Failed" });
  }

  const v = await verifyVendor(vendorId);
  steps.push({ step: "Registry verification", ok: v.result !== "UNABLE_TO_VERIFY", message: v.result.replace(/_/g, " ") });

  await logActivity(vendorId, "CHECK", `Checks run: ${steps.map((s) => `${s.step} – ${s.message}`).join("; ")}`);
  const evaluation = await evaluateVendor(vendorId);
  return { steps, evaluation, vendor: await getVendor(vendorId) };
}

export function listActivity(vendorId: string) {
  return prisma.activity.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, take: 100 });
}
