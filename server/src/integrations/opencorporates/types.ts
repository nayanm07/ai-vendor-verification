/** Subset of the OpenCorporates v0.4 company object that we use. */
export interface OCCompany {
  name: string;
  company_number: string;
  jurisdiction_code: string;
  incorporation_date: string | null;
  company_type: string | null;
  current_status: string | null;
  registered_address_in_full: string | null;
  opencorporates_url: string;
}

/** GET /companies/:jurisdiction/:number */
export interface OCCompanyResponse {
  results: { company: OCCompany };
}

/** GET /companies/search */
export interface OCSearchResponse {
  results: { companies: { company: OCCompany }[]; total_count: number };
}

export interface CompanyRegistryClient {
  readonly mode: "live" | "mock";
  /** Returns null when the company does not exist. */
  getByNumber(jurisdiction: string, companyNumber: string): Promise<OCCompanyResponse | null>;
  searchByName(name: string, jurisdiction?: string): Promise<OCSearchResponse>;
}

/** Thrown for transport/auth/rate-limit failures — distinct from "company not found". */
export class RegistryError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
