import fs from "node:fs/promises";
import OpenAI, { APIError } from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { z } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!env.openaiApiKey) throw new HttpError(503, "OpenAI API key is not configured (OPENAI_API_KEY)");
  client ??= new OpenAI({ apiKey: env.openaiApiKey, timeout: 60_000, maxRetries: 1 });
  return client;
}

/** Maps OpenAI SDK errors to user-facing HTTP errors without leaking internals. */
function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  if (err instanceof APIError) {
    if (err.status === 401) return new HttpError(502, "OpenAI rejected the API key");
    if (err.status === 429) return new HttpError(503, "OpenAI rate limit or quota exceeded — try again later");
    if (err.status === 400) return new HttpError(422, `OpenAI could not process the request: ${err.message}`);
    return new HttpError(502, `OpenAI request failed (${err.status ?? "network error"})`);
  }
  return new HttpError(502, "AI processing failed");
}

/** Sends a prompt + optional file to the model and returns JSON validated against `schema`. */
async function structuredCompletion<T>(opts: {
  system: string;
  content: ChatCompletionContentPart[];
  schemaName: string;
  jsonSchema: Record<string, unknown>;
  schema: z.ZodType<T>;
}): Promise<T> {
  try {
    const completion = await getClient().chat.completions.create({
      model: env.openaiModel,
      temperature: 0,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.content },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: opts.schemaName, strict: true, schema: opts.jsonSchema },
      },
    });
    const message = completion.choices[0]?.message;
    if (message?.refusal) throw new HttpError(422, `AI refused the request: ${message.refusal}`);
    if (!message?.content) throw new HttpError(502, "AI returned an empty response");
    return opts.schema.parse(JSON.parse(message.content));
  } catch (err) {
    if (err instanceof z.ZodError || err instanceof SyntaxError) {
      throw new HttpError(502, "AI returned data in an unexpected format");
    }
    throw toHttpError(err);
  }
}

// ---------------------------------------------------------------- extraction

export const EXTRACTED_FIELDS = ["companyName", "regNumber", "gstNumber", "address", "bankAccount", "ifsc"] as const;
export type ExtractedField = (typeof EXTRACTED_FIELDS)[number];

const nullableString = { type: ["string", "null"] };

const extractionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [...EXTRACTED_FIELDS, "detectedDocumentType", "notes"],
  properties: {
    companyName: {
      ...nullableString,
      description: "Legal name of the company (or bank account holder) exactly as printed, with normal spacing",
    },
    regNumber: {
      ...nullableString,
      description:
        "Company incorporation number (CIN / company number). NEVER put a GSTIN, PAN or tax number here; null if the document has no incorporation number",
    },
    gstNumber: { ...nullableString, description: "GSTIN, VAT or tax identification number" },
    address: {
      ...nullableString,
      description:
        "The company's own registered or business address, with normal word spacing. NOT the address of a bank branch or the issuing authority",
    },
    bankAccount: { ...nullableString, description: "Bank account number" },
    ifsc: { ...nullableString, description: "IFSC / bank branch code" },
    detectedDocumentType: {
      type: "string",
      enum: ["REGISTRATION", "GST", "BANK", "OTHER"],
      description: "What kind of document this actually appears to be",
    },
    notes: { type: "string", description: "Short note on legibility or anything uncertain; empty if none" },
  },
};

export const extractionSchema = z.object({
  companyName: z.string().nullable(),
  regNumber: z.string().nullable(),
  gstNumber: z.string().nullable(),
  address: z.string().nullable(),
  bankAccount: z.string().nullable(),
  ifsc: z.string().nullable(),
  detectedDocumentType: z.enum(["REGISTRATION", "GST", "BANK", "OTHER"]),
  notes: z.string(),
});
export type ExtractionResult = z.infer<typeof extractionSchema>;

const DOC_LABELS: Record<string, string> = {
  REGISTRATION: "Company Registration Certificate",
  GST: "GST / Tax Registration Certificate",
  BANK: "Bank document (cancelled cheque / bank letter / statement)",
};

export async function extractDocument(file: { filePath: string; mimeType: string; originalName: string }, docType: string) {
  const base64 = (await fs.readFile(file.filePath)).toString("base64");
  const dataUrl = `data:${file.mimeType};base64,${base64}`;
  const filePart: ChatCompletionContentPart =
    file.mimeType === "application/pdf"
      ? { type: "file", file: { filename: file.originalName, file_data: dataUrl } }
      : { type: "image_url", image_url: { url: dataUrl, detail: "high" } };

  const result = await structuredCompletion({
    system:
      "You extract structured data from vendor onboarding documents. " +
      "Copy values exactly as they appear (preserve spelling, suffixes like 'Pvt Ltd', punctuation and word spacing). " +
      "Each value belongs to exactly one field — never copy the same identifier into two fields. " +
      "Never guess or infer a value that is not visibly present — use null instead.",
    content: [
      { type: "text", text: `The user uploaded this as: ${DOC_LABELS[docType] ?? docType}. Extract the fields.` },
      filePart,
    ],
    schemaName: "vendor_document_extraction",
    jsonSchema: extractionJsonSchema,
    schema: extractionSchema,
  });
  return normalizeExtraction(result, docType);
}

const PLACEHOLDERS = new Set(["", "null", "none", "n/a", "na", "-", "not available", "not found"]);
const clean = (v: string | null) => {
  const t = v?.replace(/\s+/g, " ").trim() ?? "";
  return PLACEHOLDERS.has(t.toLowerCase()) ? null : t;
};
const compact = (v: string | null) => clean(v)?.replace(/[\s-]/g, "").toUpperCase() ?? null;

/** Deterministic cleanup the model shouldn't be trusted with: placeholders, identifier formatting, duplicate IDs. */
function normalizeExtraction(r: ExtractionResult, docType: string): ExtractionResult {
  const out = {
    ...r,
    companyName: clean(r.companyName),
    address: clean(r.address),
    regNumber: compact(r.regNumber),
    gstNumber: compact(r.gstNumber),
    bankAccount: compact(r.bankAccount),
    ifsc: compact(r.ifsc),
  };
  if (out.regNumber && out.regNumber === out.gstNumber) out.regNumber = null;
  // Addresses on bank letters/cheques are the branch's, not the vendor's — comparing them causes false mismatches.
  if (docType === "BANK") out.address = null;
  return out;
}

// ---------------------------------------------------------------- comparison

const comparisonJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["fields", "summary"],
  properties: {
    fields: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "status", "note"],
        properties: {
          field: { type: "string", enum: [...EXTRACTED_FIELDS] },
          status: { type: "string", enum: ["MATCH", "MISMATCH", "MISSING"] },
          note: { type: "string", description: "One sentence explaining the verdict, naming the sources that differ" },
        },
      },
    },
    summary: { type: "string", description: "2-3 sentence overall assessment for a reviewer" },
  },
};

const comparisonSchema = z.object({
  fields: z.array(
    z.object({
      field: z.enum(EXTRACTED_FIELDS),
      status: z.enum(["MATCH", "MISMATCH", "MISSING"]),
      note: z.string(),
    }),
  ),
  summary: z.string(),
});

/** Per field: the values found in sources expected to carry it, and expected sources where it was absent. */
export type FieldEvidence = Record<ExtractedField, { values: Record<string, string>; missingFrom: string[] }>;

export function compareSources(evidence: FieldEvidence) {
  return structuredCompletion({
    system:
      "You are a KYC analyst comparing vendor information across sources. " +
      "For each field you get `values` (source → value, only from sources expected to contain that field) " +
      "and `missingFrom` (uploaded sources that should have contained it but did not). Decide:\n" +
      "- MISMATCH: any two values disagree in substance — including singular/plural or spelling differences " +
      "in a company name (e.g. 'ABC Technologies' vs 'ABC Technology' is a MISMATCH), or any character difference in an identifier.\n" +
      "- MISSING: `values` is empty, or `missingFrom` is non-empty and the values otherwise agree.\n" +
      "- MATCH: all values agree and `missingFrom` is empty. Ignore case, whitespace and punctuation. " +
      "Treat standard abbreviations as equal (Pvt = Private, Ltd = Limited, & = and).\n" +
      "MISMATCH takes priority over MISSING. Return exactly one entry per field.",
    content: [{ type: "text", text: JSON.stringify(evidence, null, 2) }],
    schemaName: "vendor_cross_document_comparison",
    jsonSchema: comparisonJsonSchema,
    schema: comparisonSchema,
  });
}
