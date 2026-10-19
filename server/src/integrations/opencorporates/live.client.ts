import { RegistryError, type CompanyRegistryClient, type OCCompanyResponse, type OCSearchResponse } from "./types.js";

const BASE_URL = "https://api.opencorporates.com/v0.4";
const TIMEOUT_MS = 10_000;

export class LiveOpenCorporatesClient implements CompanyRegistryClient {
  readonly mode = "live" as const;

  constructor(private token: string) {}

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries({ ...params, api_token: this.token })) url.searchParams.set(k, v);

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      throw new RegistryError(timedOut ? "OpenCorporates request timed out" : "Could not reach OpenCorporates");
    }

    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new RegistryError("OpenCorporates rejected the API token", res.status);
    if (res.status === 429) throw new RegistryError("OpenCorporates rate limit exceeded", res.status);
    if (!res.ok) throw new RegistryError(`OpenCorporates returned HTTP ${res.status}`, res.status);
    return (await res.json()) as T;
  }

  getByNumber(jurisdiction: string, companyNumber: string) {
    return this.get<OCCompanyResponse>(`/companies/${jurisdiction}/${encodeURIComponent(companyNumber)}`);
  }

  async searchByName(name: string, jurisdiction?: string) {
    const params: Record<string, string> = { q: name, per_page: "5" };
    if (jurisdiction) params.jurisdiction_code = jurisdiction;
    const res = await this.get<OCSearchResponse>("/companies/search", params);
    return res ?? { results: { companies: [], total_count: 0 } };
  }
}
