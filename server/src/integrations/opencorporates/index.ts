import { env } from "../../config/env.js";
import { LiveOpenCorporatesClient } from "./live.client.js";
import { MockOpenCorporatesClient } from "./mock.client.js";
import type { CompanyRegistryClient } from "./types.js";

export * from "./types.js";

/** Live client when a token is configured (unless forced to mock), otherwise the offline mock. */
export function createRegistryClient(): CompanyRegistryClient {
  const useLive = env.openCorporatesMode === "live" || (env.openCorporatesMode === "auto" && env.openCorporatesToken);
  return useLive ? new LiveOpenCorporatesClient(env.openCorporatesToken) : new MockOpenCorporatesClient();
}

export const registryClient = createRegistryClient();
