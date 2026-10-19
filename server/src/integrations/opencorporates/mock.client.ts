import { RegistryError, type CompanyRegistryClient, type OCCompany } from "./types.js";

/**
 * Offline stand-in for OpenCorporates used when no API token is configured.
 * Returns responses in the exact v0.4 shape so the verification logic is identical in both modes.
 * All companies below are FICTITIOUS test fixtures.
 */
const FIXTURES: OCCompany[] = [
  {
    // Matches the sample documents in /sample-docs → VERIFIED
    name: "ABC TECHNOLOGIES PRIVATE LIMITED",
    company_number: "U72900KA2019PTC123456",
    jurisdiction_code: "in",
    incorporation_date: "2019-03-14",
    company_type: "Private Limited Company",
    current_status: "Active",
    registered_address_in_full: "No. 42, 3rd Floor, MG Road, Bengaluru, Karnataka, 560001, India",
    opencorporates_url: "https://opencorporates.com/companies/in/U72900KA2019PTC123456",
  },
  {
    // Registered name/address differ from what a vendor might enter → MISMATCH demo
    name: "XYZ GLOBAL SOLUTIONS PRIVATE LIMITED",
    company_number: "U74999MH2020PTC654321",
    jurisdiction_code: "in",
    incorporation_date: "2020-07-01",
    company_type: "Private Limited Company",
    current_status: "Active",
    registered_address_in_full: "Unit 7, Andheri East, Mumbai, Maharashtra, 400069, India",
    opencorporates_url: "https://opencorporates.com/companies/in/U74999MH2020PTC654321",
  },
  {
    // Inactive company → MISMATCH on status
    name: "GLOBEX INDUSTRIES LIMITED",
    company_number: "L24110DL2001PLC111222",
    jurisdiction_code: "in",
    incorporation_date: "2001-11-20",
    company_type: "Public Limited Company",
    current_status: "Strike Off",
    registered_address_in_full: "14 Connaught Place, New Delhi, Delhi, 110001, India",
    opencorporates_url: "https://opencorporates.com/companies/in/L24110DL2001PLC111222",
  },
];

/** Special inputs that simulate API failures so error handling can be demonstrated. */
const SIMULATED_ERRORS: Record<string, RegistryError> = {
  SIMULATE_TIMEOUT: new RegistryError("OpenCorporates request timed out"),
  SIMULATE_RATE_LIMIT: new RegistryError("OpenCorporates rate limit exceeded", 429),
  SIMULATE_AUTH_ERROR: new RegistryError("OpenCorporates rejected the API token", 401),
};

const delay = () => new Promise((r) => setTimeout(r, 400));
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();

function maybeFail(input: string) {
  const err = SIMULATED_ERRORS[input.trim().toUpperCase()];
  if (err) throw err;
}

export class MockOpenCorporatesClient implements CompanyRegistryClient {
  readonly mode = "mock" as const;

  async getByNumber(jurisdiction: string, companyNumber: string) {
    await delay();
    maybeFail(companyNumber);
    const company = FIXTURES.find(
      (c) => c.jurisdiction_code === jurisdiction && c.company_number === companyNumber.toUpperCase(),
    );
    return company ? { results: { company } } : null;
  }

  async searchByName(name: string, jurisdiction?: string) {
    await delay();
    maybeFail(name);
    // Loose "contains first word" search, similar to how the real endpoint returns fuzzy candidates.
    const firstWord = norm(name).split(" ")[0] ?? "";
    const companies = FIXTURES.filter(
      (c) => (!jurisdiction || c.jurisdiction_code === jurisdiction) && firstWord && norm(c.name).startsWith(firstWord),
    ).map((company) => ({ company }));
    return { results: { companies, total_count: companies.length } };
  }
}
