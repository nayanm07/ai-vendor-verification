import { Router, type Request } from "express";
import * as verificationService from "../services/verification.service.js";
import { evaluateVendor } from "../services/workflow.service.js";

const vendorIdOf = (req: Request) => String(req.params.id);

/** Routes nested under /api/vendors/:id */
export const verificationRouter = Router({ mergeParams: true });

verificationRouter.post("/verify", async (req, res) => {
  const verification = await verificationService.verifyVendor(vendorIdOf(req));
  await evaluateVendor(verification.vendorId);
  res.status(201).json(verification);
});

verificationRouter.get("/verifications/latest", async (req, res) => {
  res.json(await verificationService.latestVerification(vendorIdOf(req)));
});
