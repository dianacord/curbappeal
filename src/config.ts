// Central config: agency identity, pricing, model + mode resolution.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = new URL("..", import.meta.url).pathname;
export const KITS_DIR = join(ROOT, "kits");
export const FIXTURES_DIR = join(ROOT, "fixtures");

export interface AgencyConfig {
  name: string;
  owner: string;
  email: string;
  phone: string;
  city: string;
  currency: string;
}

export interface Pricing {
  starter: { setup: number };
  growth: { setup: number; monthly: number };
  partner: { setup: number; monthly: number };
}

export interface AppConfig {
  agency: AgencyConfig;
  pricing: Pricing;
  model: string;
  cliModel: string;
  port: number;
}

const DEFAULTS: AppConfig = {
  agency: {
    name: "CurbAppeal Studio",
    owner: "Diana Cordovez",
    email: "dianacarolina.cordovez@gmail.com",
    phone: "",
    city: "",
    currency: "USD",
  },
  pricing: {
    starter: { setup: 490 },
    growth: { setup: 890, monthly: 290 },
    partner: { setup: 1490, monthly: 490 },
  },
  model: "claude-opus-4-8",
  cliModel: "claude-opus-4-8",
  port: 4747,
};

function loadConfig(): AppConfig {
  const path = join(ROOT, "config.json");
  if (!existsSync(path)) return DEFAULTS;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8"));
    return {
      ...DEFAULTS,
      ...raw,
      agency: { ...DEFAULTS.agency, ...(raw.agency ?? {}) },
      pricing: { ...DEFAULTS.pricing, ...(raw.pricing ?? {}) },
    };
  } catch (err) {
    console.error(`config.json is invalid, using defaults: ${err}`);
    return DEFAULTS;
  }
}

export const config = loadConfig();
export const PORT = Number(process.env.PORT || config.port);

export type LlmMode = "api" | "cli" | "mock";
export type PlacesMode = "live" | "fixture";

export function resolveLlmMode(): LlmMode {
  const forced = process.env.CURBAPPEAL_LLM_MODE as LlmMode | undefined;
  if (forced === "api" || forced === "cli" || forced === "mock") return forced;
  if (process.env.ANTHROPIC_API_KEY) return "api";
  if (Bun.which("claude")) return "cli";
  return "mock";
}

export function resolvePlacesMode(): PlacesMode {
  if (process.env.CURBAPPEAL_PLACES_MODE === "fixture") return "fixture";
  if (process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY) return "live";
  return "fixture";
}

export function placesApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: config.agency.currency || "USD",
    maximumFractionDigits: 0,
  }).format(n);
}
