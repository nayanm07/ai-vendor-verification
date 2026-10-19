import fs from "node:fs/promises";
import type { DocType, Document, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError, badRequest, notFound } from "../utils/httpError.js";
import { getVendor } from "./vendor.service.js";
import { compareSources, extractDocument, EXTRACTED_FIELDS, type SourceValues } from "./ai.service.js";

export const DOC_TYPES: DocType[] = ["REGISTRATION", "GST", "BANK"];

export function listDocuments(vendorId: string) {
  return prisma.document.findMany({ where: { vendorId }, orderBy: { uploadedAt: "desc" } });
}

export async function getDocument(id: string) {
  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw notFound("Document");
  return doc;
}

/** Runs AI extraction and persists the outcome; failures are stored on the document, not thrown. */
async function runExtraction(doc: Document) {
  try {
    const result = await extractDocument(doc, doc.docType);
    return prisma.document.update({
      where: { id: doc.id },
      data: { extractionStatus: "EXTRACTED", extractedData: result, extractionError: null, editedAt: null },
    });
  } catch (err) {
    const message = err instanceof HttpError ? err.message : "AI extraction failed";
    return prisma.document.update({
      where: { id: doc.id },
      data: { extractionStatus: "FAILED", extractionError: message },
    });
  }
}

/** One active document per type: uploading a new one replaces the previous file. */
export async function uploadDocument(vendorId: string, docType: DocType, file: Express.Multer.File) {
  await getVendor(vendorId);

  const previous = await prisma.document.findMany({ where: { vendorId, docType } });
  const doc = await prisma.document.create({
    data: {
      vendorId,
      docType,
      originalName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
    },
  });
  if (previous.length) {
    await prisma.document.deleteMany({ where: { id: { in: previous.map((d) => d.id) } } });
    await Promise.all(previous.map((d) => fs.rm(d.filePath, { force: true })));
  }
  return runExtraction(doc);
}

export async function reExtract(id: string) {
  return runExtraction(await getDocument(id));
}

const editSchemaKeys = new Set<string>(EXTRACTED_FIELDS);

/** Reviewer correction of AI-extracted values. */
export async function updateExtractedData(id: string, values: Record<string, unknown>) {
  const doc = await getDocument(id);
  const current = (doc.extractedData ?? {}) as Record<string, unknown>;
  const patch: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(values)) {
    if (!editSchemaKeys.has(k)) continue;
    if (v !== null && typeof v !== "string") throw badRequest(`Field ${k} must be a string or null`);
    patch[k] = typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  }
  return prisma.document.update({
    where: { id },
    data: {
      extractedData: { ...current, ...patch } as Prisma.InputJsonValue,
      extractionStatus: "EXTRACTED",
      extractionError: null,
      editedAt: new Date(),
    },
  });
}

export async function deleteDocument(id: string) {
  const doc = await getDocument(id);
  await prisma.document.delete({ where: { id } });
  await fs.rm(doc.filePath, { force: true });
}

// ---------------------------------------------------------------- comparison

export async function compareVendor(vendorId: string) {
  const vendor = await getVendor(vendorId);
  const docs = await prisma.document.findMany({ where: { vendorId, extractionStatus: "EXTRACTED" } });
  if (docs.length === 0) throw badRequest("Upload and extract at least one document before comparing");

  const sources: SourceValues = {
    "Vendor Form": Object.fromEntries(EXTRACTED_FIELDS.map((f) => [f, vendor[f] || null])),
  };
  for (const d of docs) {
    const data = d.extractedData as Record<string, string | null>;
    sources[`${d.docType} Document`] = Object.fromEntries(EXTRACTED_FIELDS.map((f) => [f, data?.[f] ?? null]));
  }

  const ai = await compareSources(sources);

  // Attach the raw per-source values so the UI can show them side by side.
  const fields = EXTRACTED_FIELDS.map((field) => {
    const verdict = ai.fields.find((f) => f.field === field) ?? { status: "MISSING", note: "Not assessed" };
    return {
      field,
      status: verdict.status,
      note: verdict.note,
      values: Object.fromEntries(Object.entries(sources).map(([src, vals]) => [src, vals[field] ?? null])),
    };
  });
  const missingDocuments = DOC_TYPES.filter((t) => !docs.some((d) => d.docType === t));
  const hasMismatch = fields.some((f) => f.status === "MISMATCH");

  return prisma.comparison.create({
    data: {
      vendorId,
      hasMismatch,
      result: { fields, summary: ai.summary, missingDocuments, sources: Object.keys(sources) },
    },
  });
}

export function latestComparison(vendorId: string) {
  return prisma.comparison.findFirst({ where: { vendorId }, orderBy: { createdAt: "desc" } });
}
