import type { Prisma, VerificationResult } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { getVendor } from "./vendor.service.js";
import { registryClient, RegistryError, type OCCompany } from "../integrations/opencorporates/index.js";

type FieldCheck = { field: string; vendorValue: string | null; registryValue: string | null; match: boolean | null };

const ACTIVE_STATUSES = ["active", "live", "registered", "good standing"];

const SUFFIXES: [RegExp, string][] = [
  [/\bpvt\b/g, "private"],
  [/\bltd\b/g, "limited"],
  [/\bco\b/g, "company"],
  [/\binc\b/g, "incorporated"],
  [/&/g, " and "],
];

export function normalizeName(name: string) {
  let n = name.toLowerCase();
  for (const [re, rep] of SUFFIXES) n = n.replace(re, rep);
  return n.replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

const compactId = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

/** Share of the vendor address's meaningful tokens that appear in the registry address. */
function addressSimilarity(a: string, b: string) {
  const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((t) => t.length > 1));
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0) return 0;
  return [...ta].filter((t) => tb.has(t)).length / ta.size;
}

function compareWithVendor(company: OCCompany, vendor: { companyName: string; regNumber: string; address: string }) {
  const checks: FieldCheck[] = [
    {
      field: "companyName",
      vendorValue: vendor.companyName,
      registryValue: company.name,
      match: normalizeName(vendor.companyName) === normalizeName(company.name),
    },
    {
      field: "regNumber",
      vendorValue: vendor.regNumber || null,
      registryValue: company.company_number,
      match: vendor.regNumber ? compactId(vendor.regNumber) === compactId(company.company_number) : null,
    },
    {
      field: "address",
      vendorValue: vendor.address || null,
      registryValue: company.registered_address_in_full,
      match:
        vendor.address && company.registered_address_in_full
          ? addressSimilarity(vendor.address, company.registered_address_in_full) >= 0.7
          : null,
    },
  ];
  const isActive = ACTIVE_STATUSES.includes((company.current_status ?? "").toLowerCase());
  return { checks, isActive };
}

/**
 * Looks the vendor up in the company registry (registration number first, then name) and
 * classifies the outcome as VERIFIED / MISMATCH / UNABLE_TO_VERIFY. Always records an audit row.
 */
export async function verifyVendor(vendorId: string) {
  const vendor = await getVendor(vendorId);
  const jurisdiction = env.openCorporatesJurisdiction;
  const source = `opencorporates${registryClient.mode === "mock" ? "-mock" : ""}`;

  let searchedBy = vendor.regNumber ? "regNumber" : "companyName";
  let query = vendor.regNumber || vendor.companyName;
  let company: OCCompany | null = null;
  let raw: unknown = null;

  try {
    if (vendor.regNumber) {
      const res = await registryClient.getByNumber(jurisdiction, vendor.regNumber);
      raw = res;
      company = res?.results.company ?? null;
    }
    if (!company) {
      searchedBy = "companyName";
      query = vendor.companyName;
      const res = await registryClient.searchByName(vendor.companyName, jurisdiction);
      raw = res;
      const candidates = res.results.companies.map((c) => c.company);
      // Prefer an exact normalized-name hit, else the top-ranked candidate.
      company = candidates.find((c) => normalizeName(c.name) === normalizeName(vendor.companyName)) ?? candidates[0] ?? null;
    }
  } catch (err) {
    const message = err instanceof RegistryError ? err.message : "Unexpected error calling the company registry";
    if (!(err instanceof RegistryError)) console.error(err);
    return save(vendorId, { source, searchedBy, query, result: "UNABLE_TO_VERIFY", error: message });
  }

  if (!company) {
    return save(vendorId, {
      source,
      searchedBy,
      query,
      result: "UNABLE_TO_VERIFY",
      rawResponse: raw,
      error: `No company found in the registry for "${query}"`,
    });
  }

  const { checks, isActive } = compareWithVendor(company, vendor);
  const mismatches = checks.filter((c) => c.match === false).map((c) => c.field);
  if (!isActive) mismatches.push("status");
  const result: VerificationResult = mismatches.length ? "MISMATCH" : "VERIFIED";

  return save(vendorId, {
    source,
    searchedBy,
    query,
    result,
    rawResponse: raw,
    details: {
      company: {
        name: company.name,
        companyNumber: company.company_number,
        jurisdiction: company.jurisdiction_code,
        status: company.current_status,
        incorporationDate: company.incorporation_date,
        companyType: company.company_type,
        address: company.registered_address_in_full,
        url: company.opencorporates_url,
      },
      checks,
      isActive,
      mismatches,
    },
  });
}

function save(
  vendorId: string,
  data: {
    source: string;
    searchedBy: string;
    query: string;
    result: VerificationResult;
    details?: unknown;
    rawResponse?: unknown;
    error?: string;
  },
) {
  return prisma.verification.create({
    data: {
      vendorId,
      ...data,
      details: (data.details ?? undefined) as Prisma.InputJsonValue | undefined,
      rawResponse: (data.rawResponse ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export function latestVerification(vendorId: string) {
  return prisma.verification.findFirst({ where: { vendorId }, orderBy: { createdAt: "desc" } });
}
