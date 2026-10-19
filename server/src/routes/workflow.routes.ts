import { Router, type Request } from "express";
import { z } from "zod";
import * as workflow from "../services/workflow.service.js";
import * as taskService from "../services/task.service.js";
import { getChecklist } from "../services/checklist.service.js";
import { listEmailLogs, notifyMissingDocuments } from "../services/notification.service.js";
import { getVendor } from "../services/vendor.service.js";
import { statusUpdateSchema } from "../validation/vendor.schema.js";
import { badRequest } from "../utils/httpError.js";

const vendorIdOf = (req: Request) => String(req.params.id);

/** Routes nested under /api/vendors/:id */
export const vendorWorkflowRouter = Router({ mergeParams: true });

vendorWorkflowRouter.get("/checklist", async (req, res) => {
  res.json(await getChecklist(vendorIdOf(req)));
});

vendorWorkflowRouter.get("/emails", async (req, res) => {
  res.json(await listEmailLogs(vendorIdOf(req)));
});

/** Manual reminder — bypasses the 24h cooldown. */
vendorWorkflowRouter.post("/notify-missing", async (req, res) => {
  const vendor = await getVendor(vendorIdOf(req));
  const missing = (await getChecklist(vendor.id)).filter((c) => c.status === "MISSING").map((c) => c.docType);
  if (missing.length === 0) throw badRequest("No documents are missing");
  const result = await notifyMissingDocuments(vendor, missing, { force: true });
  if (result.sent.length) await workflow.logActivity(vendor.id, "EMAIL", `Reminder sent to ${vendor.email}`, "reviewer");
  if (result.error) throw badRequest(`Email failed: ${result.error}`);
  res.json(result);
});

vendorWorkflowRouter.get("/workflow", async (req, res) => {
  const vendor = await getVendor(vendorIdOf(req));
  res.json({ status: vendor.status, allowedTransitions: workflow.allowedTransitions(vendor.status) });
});

vendorWorkflowRouter.patch("/status", async (req, res) => {
  const { status } = statusUpdateSchema.parse(req.body);
  res.json(await workflow.changeStatus(vendorIdOf(req), status));
});

vendorWorkflowRouter.post("/run-checks", async (req, res) => {
  res.json(await workflow.runAllChecks(vendorIdOf(req)));
});

vendorWorkflowRouter.get("/activity", async (req, res) => {
  res.json(await workflow.listActivity(vendorIdOf(req)));
});

const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
  dueDate: z.coerce.date(),
});

vendorWorkflowRouter.get("/tasks", async (req, res) => {
  res.json(await taskService.listTasks({ vendorId: vendorIdOf(req) }));
});

vendorWorkflowRouter.post("/tasks", async (req, res) => {
  const task = await taskService.createTask(vendorIdOf(req), taskInputSchema.parse(req.body));
  await workflow.logActivity(task.vendorId, "TASK", `Task created: ${task.title}`, "reviewer");
  res.status(201).json(task);
});

/** Routes under /api/tasks */
export const taskRouter = Router();

taskRouter.get("/", async (req, res) => {
  const status = z.enum(["PENDING", "COMPLETED"]).optional().parse(req.query.status);
  res.json(await taskService.listTasks({ status }));
});

taskRouter.patch("/:id", async (req, res) => {
  const { status } = z.object({ status: z.enum(["PENDING", "COMPLETED"]) }).parse(req.body);
  const task = await taskService.updateTaskStatus(req.params.id, status);
  await workflow.logActivity(task.vendorId, "TASK", `Task marked ${status.toLowerCase()}: ${task.title}`, "reviewer");
  res.json(task);
});
