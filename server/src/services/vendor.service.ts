import type { Prisma, Vendor } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { notFound, badRequest } from "../utils/httpError.js";
import { VENDOR_FIELDS, type VendorDetails } from "../validation/vendor.schema.js";

export type FieldChange = { field: string; previous: string | null; next: string };

function pickDetails(vendor: Vendor): VendorDetails {
  return Object.fromEntries(VENDOR_FIELDS.map((f) => [f, vendor[f]])) as VendorDetails;
}

function diff(previous: VendorDetails | null, next: VendorDetails): FieldChange[] {
  return VENDOR_FIELDS.filter((f) => (previous?.[f] ?? null) !== next[f]).map((f) => ({
    field: f,
    previous: previous?.[f] ?? null,
    next: next[f],
  }));
}

export function listVendors() {
  return prisma.vendor.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function getVendor(id: string) {
  const vendor = await prisma.vendor.findUnique({ where: { id } });
  if (!vendor) throw notFound("Vendor");
  return vendor;
}

export function createVendor(data: VendorDetails) {
  return prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({ data });
    await tx.vendorVersion.create({
      data: {
        vendorId: vendor.id,
        versionNo: 1,
        snapshot: data,
        changedFields: diff(null, data) as Prisma.InputJsonValue,
        note: "Created",
      },
    });
    return vendor;
  });
}

/** Applies new details and records a version only if something actually changed. */
async function applyDetails(id: string, data: VendorDetails, note?: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.vendor.findUnique({ where: { id } });
    if (!current) throw notFound("Vendor");

    const changes = diff(pickDetails(current), data);
    if (changes.length === 0) return { vendor: current, changes };

    const versionNo = current.currentVersion + 1;
    const vendor = await tx.vendor.update({
      where: { id },
      data: { ...data, currentVersion: versionNo },
    });
    await tx.vendorVersion.create({
      data: {
        vendorId: id,
        versionNo,
        snapshot: data,
        changedFields: changes as Prisma.InputJsonValue,
        note,
      },
    });
    return { vendor, changes };
  });
}

export function updateVendor(id: string, data: VendorDetails) {
  return applyDetails(id, data, "Edited");
}

export async function listVersions(vendorId: string) {
  await getVendor(vendorId);
  return prisma.vendorVersion.findMany({ where: { vendorId }, orderBy: { versionNo: "desc" } });
}

/** Restoring never rewrites history: it creates a new version whose content equals the old one. */
export async function restoreVersion(vendorId: string, versionNo: number) {
  const version = await prisma.vendorVersion.findUnique({
    where: { vendorId_versionNo: { vendorId, versionNo } },
  });
  if (!version) throw notFound(`Version ${versionNo}`);

  const result = await applyDetails(vendorId, version.snapshot as VendorDetails, `Restored from version ${versionNo}`);
  if (result.changes.length === 0) throw badRequest(`Vendor already matches version ${versionNo}`);
  return result;
}
