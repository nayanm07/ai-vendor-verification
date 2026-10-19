import fs from "node:fs/promises";
import { Router, type Request } from "express";
import { z } from "zod";
import * as documentService from "../services/document.service.js";
import { upload } from "../middleware/upload.js";
import { badRequest } from "../utils/httpError.js";

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
  try {
    const { docType } = uploadBodySchema.parse(req.body);
    res.status(201).json(await documentService.uploadDocument(vendorIdOf(req), docType, req.file));
  } catch (err) {
    // Multer has already written the file; don't leave orphans behind on rejected uploads.
    await fs.rm(req.file.path, { force: true });
    throw err;
  }
});

vendorDocumentRouter.post("/compare", async (req, res) => {
  res.status(201).json(await documentService.compareVendor(vendorIdOf(req)));
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
  res.json(await documentService.reExtract(req.params.id));
});

documentRouter.put("/:id", async (req, res) => {
  const body = z.object({ extractedData: z.record(z.string(), z.unknown()) }).parse(req.body);
  res.json(await documentService.updateExtractedData(req.params.id, body.extractedData));
});

documentRouter.delete("/:id", async (req, res) => {
  await documentService.deleteDocument(req.params.id);
  res.status(204).end();
});
