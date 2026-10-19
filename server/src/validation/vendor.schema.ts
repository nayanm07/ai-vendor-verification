import { z } from "zod";

export const VENDOR_FIELDS = [
  "companyName",
  "contactPerson",
  "email",
  "phone",
  "address",
  "regNumber",
  "gstNumber",
  "bankAccount",
  "ifsc",
] as const;

export type VendorField = (typeof VENDOR_FIELDS)[number];
export type VendorDetails = Record<VendorField, string>;

const optionalText = z.string().trim().default("");

// Only identity + contact are mandatory at save time; missing registration/tax/bank
// details are surfaced later by the comparison and checklist steps.
export const vendorInputSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  contactPerson: z.string().trim().min(1, "Contact person is required"),
  email: z.string().trim().toLowerCase().pipe(z.email("Invalid email address")),
  phone: optionalText.refine((v) => v === "" || /^[+\d][\d\s-]{6,}$/.test(v), "Invalid phone number"),
  address: optionalText,
  regNumber: optionalText.transform((v) => v.toUpperCase()),
  gstNumber: optionalText.transform((v) => v.toUpperCase()),
  bankAccount: optionalText.refine((v) => v === "" || /^\d{6,20}$/.test(v), "Bank account must be 6–20 digits"),
  ifsc: optionalText
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "" || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v), "Invalid IFSC code (e.g. HDFC0001234)"),
});

export const statusUpdateSchema = z.object({
  status: z.enum(["DRAFT", "UNDER_REVIEW", "ACTION_REQUIRED", "APPROVED", "REJECTED"]),
});
