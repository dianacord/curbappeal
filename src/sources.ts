// Research sources: resolve user input → a Google place, then harvest
// the place record, the business website, and social handles.
// Only official APIs and the business's own public pages are touched.
import { join } from "node:path";
import { readFileSync, readdirSync, existsSync, copyFileSync, mkdirSync } from "node:fs";
import { FIXTURES_DIR, placesApiKey, type PlacesMode } from "./config";

export interface PlaceRecord {
  id: string;
  displayName?: { text?: string };
  primaryTypeDisplayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  googleMapsUri?: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  websiteUri?: string;
  editorialSummary?: { text?: string };
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  photos?: { name: string }[];
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    authorAttribution?: { displayName?: string };
    text?: { text?: string };
  }[];
}

export interface WebsiteHarvest {
  url: string;
  ok: boolean;
  title?: string;
  metaDescription?: string;
  textSample?: string;
  socials: { platform: string; url: string }[];
  error?: string;
}

export interface Harvest {
  place: PlaceRecord;
  website: WebsiteHarvest | null;
  socialMentions: string[]; // handles spotted in review text, e.g. "@lavecinapdx"
  photoFiles: string[];     // kit-relative paths under assets/
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const DETAILS_FIELDS = [
  "id", "displayName", "primaryTypeDisplayName", "formattedAddress",
  "internationalPhoneNumber", "googleMapsUri", "rating", "userRatingCount",
  "priceLevel", "websiteUri", "editorialSummary", "regularOpeningHours",
  "photos", "reviews",
].join(",");

export function timeoutFetch(ms: number): Fetcher {
  return (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(ms), redirect: init?.redirect ?? "follow" });
}

// Guard against SSRF when we fetch a user-pasted URL (live Places mode only):
// reject non-http(s) schemes and literal private / loopback / link-local hosts.
// Note: this checks the hostname literal, not post-DNS resolution — sufficient for a
// localhost-bound operator tool; harden with DNS resolution if ever exposed to a network.
export function assertFetchableUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http/https links are supported.");
  }
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isPrivate =
    h === "localhost" || h === "0.0.0.0" || h === "::1" || h === "::" ||
    h === "169.254.169.254" || h.endsWith(".local") || h.endsWith(".internal") ||
    /^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^fe80:/i.test(h) || /^f[cd][0-9a-f]{2}:/i.test(h);
  if (isPrivate) throw new Error("That URL points to a private or internal address and won't be fetched.");
  return u;
}

function requireKey(): string {
  const key = placesApiKey();
  if (!key) throw new Error("No Google Places API key set. Add GOOGLE_PLACES_API_KEY to .env, or use the built-in demo businesses.");
  return key;
}

// ---------- resolve: user input → place id ----------

const PLACE_ID_RE = /^(?:place_id:)?(ChIJ[A-Za-z0-9_-]{10,})$/;

export async function resolveInput(
  query: string,
  mode: PlacesMode,
  fetcher: Fetcher = timeoutFetch(12_000),
): Promise<PlaceRecord> {
  const q = query.trim();
  if (!q) throw new Error("Empty query");

  if (mode === "fixture") return resolveFixture(q);

  const idMatch = q.match(PLACE_ID_RE);
  if (idMatch) return placeDetails(idMatch[1], fetcher);

  if (/^https?:\/\//i.test(q)) {
    assertFetchableUrl(q);
    const { name, lat, lng } = await parseMapsUrl(q, fetcher);
    if (!name) throw new Error("Couldn't read a business name from that Maps link — try pasting the business name and city instead.");
    return textSearchTop(name, fetcher, lat, lng);
  }

  return textSearchTop(q, fetcher);
}

export async function parseMapsUrl(url: string, fetcher: Fetcher): Promise<{ name?: string; lat?: number; lng?: number }> {
  let current = url;
  // Expand short links (maps.app.goo.gl / goo.gl) by following redirects manually.
  for (let hop = 0; hop < 4; hop++) {
    if (/google\.[a-z.]+\/maps/i.test(current)) break;
    assertFetchableUrl(current); // re-check every hop — redirects are attacker-influenced
    const res = await fetcher(current, { redirect: "manual", method: "HEAD" });
    const loc = res.headers.get("location");
    if (!loc) break;
    current = new URL(loc, current).toString();
  }
  const out: { name?: string; lat?: number; lng?: number } = {};
  const nameMatch = current.match(/\/maps\/place\/([^/@?]+)/);
  if (nameMatch) out.name = decodeURIComponent(nameMatch[1].replace(/\+/g, " "));
  const coordMatch = current.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    out.lat = Number(coordMatch[1]);
    out.lng = Number(coordMatch[2]);
  }
  const qMatch = !out.name && current.match(/[?&]q=([^&]+)/);
  if (qMatch) out.name = decodeURIComponent(qMatch[1].replace(/\+/g, " "));
  return out;
}

async function textSearchTop(query: string, fetcher: Fetcher, lat?: number, lng?: number): Promise<PlaceRecord> {
  const key = requireKey();
  const body: Record<string, unknown> = { textQuery: query, pageSize: 1 };
  if (lat !== undefined && lng !== undefined) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 2000 } };
  }
  const res = await fetcher("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Places searchText failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { places?: { id: string }[] };
  const top = data.places?.[0];
  if (!top) throw new Error(`No Google Maps result for "${query}"`);
  return placeDetails(top.id, fetcher);
}

export async function placeDetails(id: string, fetcher: Fetcher = timeoutFetch(12_000)): Promise<PlaceRecord> {
  const key = requireKey();
  const res = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
    headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": DETAILS_FIELDS },
  });
  if (!res.ok) throw new Error(`Place details failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as PlaceRecord;
}

// ---------- fixtures ----------

export function listFixtures(): PlaceRecord[] {
  const dir = join(FIXTURES_DIR, "places");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as PlaceRecord);
}

const STOPWORDS = new Set(["and", "the", "of", "a", "an", "el", "la", "los", "las", "de", "y"]);

function resolveFixture(q: string): PlaceRecord {
  const fixtures = listFixtures();
  const norm = (s: string) =>
    s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const nq = norm(q);
  const sigWords = nq.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const hit = fixtures.find((p) => {
    const name = norm(p.displayName?.text ?? "");
    if (name.includes(nq) || nq.includes(name)) return true;
    return sigWords.length > 0 && sigWords.every((w) => name.includes(w));
  });
  if (!hit) {
    const names = fixtures.map((p) => p.displayName?.text).join('", "');
    throw new Error(`Demo mode has no Google API key, so only the built-in demo businesses work: "${names}". Paste one of those names — or add a free GOOGLE_PLACES_API_KEY to .env to research any real business.`);
  }
  return hit;
}

// ---------- website harvest ----------

const SOCIAL_HOSTS: [string, RegExp][] = [
  ["instagram", /instagram\.com\/[A-Za-z0-9_.]+/g],
  ["facebook", /facebook\.com\/[A-Za-z0-9_.\-]+/g],
  ["tiktok", /tiktok\.com\/@?[A-Za-z0-9_.]+/g],
  ["x", /(?:twitter|x)\.com\/[A-Za-z0-9_]+/g],
  ["yelp", /yelp\.com\/biz\/[A-Za-z0-9_\-]+/g],
];

export async function harvestWebsite(url: string, fetcher: Fetcher = timeoutFetch(12_000)): Promise<WebsiteHarvest> {
  const out: WebsiteHarvest = { url, ok: false, socials: [] };
  try {
    let html: string;
    if (url.startsWith("fixture://")) {
      html = readFileSync(join(FIXTURES_DIR, url.replace("fixture://", "")), "utf8");
    } else {
      assertFetchableUrl(url);
      const res = await fetcher(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; CurbAppeal/0.1)" } });
      if (!res.ok) {
        out.error = `HTTP ${res.status}`;
        return out;
      }
      html = (await res.text()).slice(0, 400_000);
    }
    out.ok = true;
    out.title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0, 200);
    out.metaDescription = html
      .match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1]
      ?.slice(0, 400);
    const seen = new Set<string>();
    for (const [platform, re] of SOCIAL_HOSTS) {
      for (const m of html.matchAll(re)) {
        const link = `https://${m[0]}`;
        if (!seen.has(link)) {
          seen.add(link);
          out.socials.push({ platform, url: link });
        }
      }
    }
    out.textSample = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z#0-9]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000);
  } catch (err) {
    out.error = String(err).slice(0, 200);
  }
  return out;
}

export function findSocialMentions(place: PlaceRecord): string[] {
  const handles = new Set<string>();
  for (const r of place.reviews ?? []) {
    for (const m of (r.text?.text ?? "").matchAll(/@([A-Za-z0-9_.]{3,30})/g)) {
      handles.add(`@${m[1]}`);
    }
  }
  return [...handles];
}

// ---------- photos ----------

export async function collectPhotos(
  place: PlaceRecord,
  kitDir: string,
  mode: PlacesMode,
  fetcher: Fetcher = timeoutFetch(20_000),
  max = 3,
): Promise<string[]> {
  const assets = join(kitDir, "assets");
  mkdirSync(assets, { recursive: true });
  const files: string[] = [];
  const photos = (place.photos ?? []).slice(0, max);
  for (let i = 0; i < photos.length; i++) {
    const name = photos[i].name;
    try {
      if (name.startsWith("fixture://")) {
        const src = join(FIXTURES_DIR, name.replace("fixture://", ""));
        if (!existsSync(src)) continue;
        const dest = `assets/photo-${i + 1}.svg`;
        copyFileSync(src, join(kitDir, dest));
        files.push(dest);
      } else {
        const key = requireKey();
        const res = await fetcher(
          `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1600&key=${encodeURIComponent(key)}`,
        );
        if (!res.ok) continue;
        const dest = `assets/photo-${i + 1}.jpg`;
        await Bun.write(join(kitDir, dest), await res.arrayBuffer());
        files.push(dest);
      }
    } catch {
      // Missing photos never sink a kit; templates fall back to gradients.
    }
  }
  return files;
}
