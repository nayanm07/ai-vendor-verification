import { Router } from "express";
import * as vendorService from "../services/vendor.service.js";
import { vendorInputSchema } from "../validation/vendor.schema.js";
import { badRequest } from "../utils/httpError.js";

export const vendorRouter = Router();

vendorRouter.get("/", async (_req, res) => {
  res.json(await vendorService.listVendors());
});

vendorRouter.post("/", async (req, res) => {
  const data = vendorInputSchema.parse(req.body);
  res.status(201).json(await vendorService.createVendor(data));
});

vendorRouter.get("/:id", async (req, res) => {
  res.json(await vendorService.getVendor(req.params.id));
});

vendorRouter.put("/:id", async (req, res) => {
  const data = vendorInputSchema.parse(req.body);
  res.json(await vendorService.updateVendor(req.params.id, data));
});

vendorRouter.get("/:id/versions", async (req, res) => {
  res.json(await vendorService.listVersions(req.params.id));
});

vendorRouter.post("/:id/versions/:versionNo/restore", async (req, res) => {
  const versionNo = Number(req.params.versionNo);
  if (!Number.isInteger(versionNo) || versionNo < 1) throw badRequest("Invalid version number");
  res.json(await vendorService.restoreVersion(req.params.id, versionNo));
});
