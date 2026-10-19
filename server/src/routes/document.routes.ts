import fs from "node:fs/promises";
import { Router, type Request } from "express";
import { z } from "zod";
import * as documentService from "../services/document.service.js";
import { upload } from "../middleware/upload.js";
import { badRequest } from "../utils/httpError.js";
import { evaluateVendor } from "../services/workflow.service.js";

const uploadBodySchema = z.object({ docType: z.enum(["REGISTRATION", "GST", "BANK"]) });

// :id comes from the parent mount path (/api/vendors/:id), so it isn't typed on this router.
const vendorIdOf = (req: Request) => String(req.params.id);

/** Routes nested under /api/vendors/:id */
export const vendorDocumentRouter = Router({ mergeParams: true });

vendorDocumentRouter.get("/documents", async (req, res) => {
  res.json(await documentService.listDocuments(vendorIdOf(req)));
});

vendorDocumentRouter.post("/documents", upload.single("file"), async (req, res) => {
  if (!req.file) throw badRequest("No file uploaded (field name: file)");
  let doc;
  try {
    const { docType } = uploadBodySchema.parse(req.body);
    doc = await documentService.uploadDocument(vendorIdOf(req), docType, req.file);
  } catch (err) {
    // Multer has already written the file; don't leave orphans behind on rejected uploads.
    await fs.rm(req.file.path, { force: true });
    throw err;
  }
  await evaluateVendor(doc.vendorId);
  res.status(201).json(doc);
});

vendorDocumentRouter.post("/compare", async (req, res) => {
  const comparison = await documentService.compareVendor(vendorIdOf(req));
  await evaluateVendor(comparison.vendorId);
  res.status(201).json(comparison);
});

vendorDocumentRouter.get("/comparisons/latest", async (req, res) => {
  res.json(await documentService.latestComparison(vendorIdOf(req)));
});

/** Routes under /api/documents */
export const documentRouter = Router();

documentRouter.get("/:id/file", async (req, res) => {
  const doc = await documentService.getDocument(req.params.id);
  res.type(doc.mimeType).sendFile(doc.filePath);
});

documentRouter.post("/:id/extract", async (req, res) => {
  const doc = await documentService.reExtract(req.params.id);
  await evaluateVendor(doc.vendorId);
  res.json(doc);
});

documentRouter.put("/:id", async (req, res) => {
  const body = z.object({ extractedData: z.record(z.string(), z.unknown()) }).parse(req.body);
  res.json(await documentService.updateExtractedData(req.params.id, body.extractedData));
});

documentRouter.delete("/:id", async (req, res) => {
  const doc = await documentService.getDocument(req.params.id);
  await documentService.deleteDocument(doc.id);
  await evaluateVendor(doc.vendorId);
  res.status(204).end();
});
