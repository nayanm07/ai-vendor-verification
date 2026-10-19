import { Router, type Request } from "express";
import * as verificationService from "../services/verification.service.js";

const vendorIdOf = (req: Request) => String(req.params.id);

/** Routes nested under /api/vendors/:id */
export const verificationRouter = Router({ mergeParams: true });

verificationRouter.post("/verify", async (req, res) => {
  res.status(201).json(await verificationService.verifyVendor(vendorIdOf(req)));
});

verificationRouter.get("/verifications/latest", async (req, res) => {
  res.json(await verificationService.latestVerification(vendorIdOf(req)));
});
