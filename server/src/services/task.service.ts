import type { TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound } from "../utils/httpError.js";
import { getVendor } from "./vendor.service.js";

export function listTasks(filter: { vendorId?: string; status?: TaskStatus }) {
  return prisma.task.findMany({
    where: filter,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    include: { vendor: { select: { id: true, companyName: true } } },
  });
}

export async function createTask(
  vendorId: string,
  data: { title: string; description?: string; priority: TaskPriority; dueDate: Date },
) {
  await getVendor(vendorId);
  return prisma.task.create({ data: { vendorId, ...data } });
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) throw notFound("Task");
  return prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
  });
}
