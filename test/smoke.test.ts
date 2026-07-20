// Smoke suite: pure helpers, harvesting, template safety, and a full
// offline pipeline run (mock LLM + fixture places).
process.env.CURBAPPEAL_LLM_MODE = "mock";
process.env.CURBAPPEAL_PLACES_MODE = "fixture";

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { esc, extractJson, mdLite, slugify, SLUG_RE, hexColor } from "../src/util";
import { harvestWebsite, parseMapsUrl, findSocialMentions, assertFetchableUrl, type Fetcher } from "../src/sources";
import { renderLandingPage, renderProposal, type PageCopy, type ProposalCopy } from "../src/templates";
import { createKit, loadKit, runKit, kitDir, STAGE_ORDER, type KitState } from "../src/pipeline";

const HOSTILE = `<script>alert(1)</script><img src=x onerror=alert(2)> "'&`;

// Track kits created by tests so we can remove them afterward (no accumulation in kits/).
const createdSlugs: string[] = [];
function trackKit(input: Parameters<typeof createKit>[0]): KitState {
  const state = createKit(input);
  createdSlugs.push(state.slug);
  return state;
}
async function waitForKit(slug: string, ms = 30_000): Promise<KitState | null> {
  const deadline = Date.now() + ms;
  let kit = loadKit(slug);
  while (Date.now() < deadline) {
    kit = loadKit(slug);
    if (kit && (kit.stages.package === "done" || Object.values(kit.stages).includes("failed"))) break;
    await Bun.sleep(250);
  }
  return kit;
}
afterAll(() => {
  for (const slug of createdSlugs) rmSync(kitDir(slug), { recursive: true, force: true });
});

describe("util", () => {
  test("esc neutralizes HTML", () => {
    const out = esc(HOSTILE);
    expect(out).not.toContain("<script");
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;script&gt;");
  });

  test("extractJson handles plain, fenced, and prose-wrapped JSON", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('Sure! Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Note first. {"a":{"b":"x}y"}} trailing words')).toEqual({ a: { b: "x}y" } });
    expect(() => extractJson("no json here")).toThrow();
  });

  test("slugify produces valid slugs", () => {
    const s = slugify("La Vecina Café — Portland!!");
    expect(SLUG_RE.test(s)).toBe(true);
    expect(s).toStartWith("la-vecina-caf");
  });

  test("SLUG_RE rejects traversal-ish input", () => {
    for (const bad of ["../etc", "a/../../b", "a b", "UPPER", "", "..", "a".repeat(80)]) {
      expect(SLUG_RE.test(bad)).toBe(false);
    }
  });

  test("hexColor falls back on junk", () => {
    expect(hexColor("#12ab34", "#000000")).toBe("#12ab34");
    expect(hexColor("red; } body { display:none", "#000000")).toBe("#000000");
    expect(hexColor("url(javascript:x)", "#111111")).toBe("#111111");
  });

  test("mdLite escapes before rendering", () => {
    const out = mdLite(`# Title\n- item ${HOSTILE}\n\n**bold**`);
    expect(out).not.toContain("<script");
    expect(out).toContain("<strong>bold</strong>");
  });
});

describe("sources", () => {
  const noNetwork: Fetcher = async () => {
    throw new Error("network should not be touched");
  };

  test("parseMapsUrl reads long URLs without network", async () => {
    const r = await parseMapsUrl(
      "https://www.google.com/maps/place/La+Vecina+Caf%C3%A9/@45.4790,-122.6127,17z/data=abc",
      noNetwork,
    );
    expect(r.name).toBe("La Vecina Café");
    expect(r.lat).toBeCloseTo(45.479);
    expect(r.lng).toBeCloseTo(-122.6127);
  });

  test("harvestWebsite reads fixture sites and finds socials", async () => {
    const h = await harvestWebsite("fixture://sites/bloomandbark.html", noNetwork);
    expect(h.ok).toBe(true);
    expect(h.metaDescription).toContain("Cage-free");
    expect(h.socials.map((s) => s.platform)).toContain("instagram");
    expect(h.textSample).toContain("organic");
  });

  test("hostile site content is captured as inert text", async () => {
    const h = await harvestWebsite("fixture://sites/hostile.html", noNetwork);
    expect(h.ok).toBe(true);
    // The harvest itself may contain nasty strings — that's fine; templates must escape.
    expect(h.textSample).toContain("SYSTEM OVERRIDE");
    expect(h.textSample).not.toContain("<script");
  });

  test("findSocialMentions pulls handles from reviews", () => {
    const place = JSON.parse(readFileSync(join(import.meta.dir, "../fixtures/places/la-vecina-cafe.json"), "utf8"));
    expect(findSocialMentions(place)).toContain("@lavecinapdx");
  });

  test("assertFetchableUrl blocks private/internal and bad-scheme URLs (SSRF guard)", () => {
    for (const good of ["https://example.com/menu", "http://lavecinacafe.com"]) {
      expect(() => assertFetchableUrl(good)).not.toThrow();
    }
    for (const bad of [
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost:4747/api/health",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://172.16.9.9/",
      "file:///etc/passwd",
      "gopher://x",
      "not a url",
    ]) {
      expect(() => assertFetchableUrl(bad)).toThrow();
    }
  });
});

describe("templates resist hostile copy", () => {
  const hostilePage: PageCopy = {
    template: "warm",
    accent: "red;} body{display:none} .x{",
    headline: HOSTILE,
    subheadline: HOSTILE,
    badge_line: HOSTILE,
    about_heading: HOSTILE,
    about_text: HOSTILE,
    menu_heading: HOSTILE,
    menu_items: [{ name: HOSTILE, desc: HOSTILE, price: HOSTILE }],
    testimonials: [{ quote: HOSTILE, author: HOSTILE }],
    cta_heading: HOSTILE,
    cta_text: HOSTILE,
    cta_button: HOSTILE,
    footer_line: HOSTILE,
    labels: { hours: HOSTILE, call: HOSTILE, directions: HOSTILE, reviews: HOSTILE },
  };
  const hostilePlace = {
    id: "x",
    displayName: { text: HOSTILE },
    formattedAddress: HOSTILE,
    internationalPhoneNumber: "+1 555<script>",
    googleMapsUri: "javascript:alert(1)",
    rating: 4.5,
    userRatingCount: 10,
    regularOpeningHours: { weekdayDescriptions: [`Monday: ${HOSTILE}`] },
  };

  test("landing page escapes everything and has no scripts at all", () => {
    const html = renderLandingPage(hostilePage, hostilePlace as never, ["assets/photo-1.svg"]);
    // No raw active constructs may survive — escaped text (&lt;img …) is inert and fine.
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain("&lt;script&gt;");
  });

  test("proposal escapes everything", () => {
    const hostileProposal: ProposalCopy = {
      opening_line: HOSTILE,
      audit_findings: [{ label: HOSTILE, status: "bad", note: HOSTILE }],
      quote_pull: { quote: HOSTILE, author: HOSTILE },
      opportunity_paragraph: HOSTILE,
      tier_recommendation: "growth",
      tiers_pitch: { starter: HOSTILE, growth: HOSTILE, partner: HOSTILE },
      why_now_paragraph: HOSTILE,
      next_step_paragraph: HOSTILE,
    };
    const html = renderProposal(hostileProposal, hostilePlace as never, { accent: "bad" } as never, "en");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("pipeline end-to-end (mock mode, fixture places)", () => {
  test("full kit generates for La Vecina Café", async () => {
    const state = trackKit({ query: "La Vecina Café", tone: "auto", goal: "More foot traffic", language: "auto", notes: "SECRET_OPERATOR_NOTE_xyz" });
    expect(state.llmMode).toBe("mock");
    expect(state.placesMode).toBe("fixture");
    runKit(state.slug);
    const kit = await waitForKit(state.slug);

    expect(kit).not.toBeNull();
    expect(kit!.error).toBeUndefined();
    for (const s of STAGE_ORDER) expect(kit!.stages[s]).toBe("done");

    const dir = kitDir(state.slug);
    for (const f of ["place.json", "harvest.json", "brief.json", "brief.md", "page.json", "index.html", "posts.md", "proposal.html", "outreach.md", "kit.zip"]) {
      expect(existsSync(join(dir, f))).toBe(true);
    }

    const page = readFileSync(join(dir, "index.html"), "utf8");
    expect(page).toContain("La Vecina Café");
    expect(page).not.toContain("<script");
    expect(page).toContain("assets/photo-1.svg");

    const proposal = readFileSync(join(dir, "proposal.html"), "utf8");
    expect(proposal).toContain("La Vecina Café");
    expect(proposal).toContain("Google Reviews");

    const brief = readFileSync(join(dir, "brief.md"), "utf8");
    expect(brief).toContain("No website");

    // The client zip must contain deliverables only — no internal JSON, no operator notes.
    const listing = await new Response(
      Bun.spawn(["unzip", "-Z1", join(dir, "kit.zip")], { stdout: "pipe" }).stdout,
    ).text();
    expect(listing).toContain("index.html");
    expect(listing).toContain("proposal.html");
    expect(listing).not.toContain("kit.json");
    expect(listing).not.toContain("place.json");
    expect(listing).not.toContain("harvest.json");
    const zipBytes = new Uint8Array(await Bun.file(join(dir, "kit.zip")).arrayBuffer());
    expect(new TextDecoder().decode(zipBytes)).not.toContain("SECRET_OPERATOR_NOTE_xyz");
  }, 40_000);

  test("website-having business harvests socials (Bloom & Bark)", async () => {
    const state = trackKit({ query: "Bloom and Bark", tone: "modern", goal: "More bookings", language: "en", notes: "" });
    runKit(state.slug);
    const kit = await waitForKit(state.slug);
    expect(kit!.error).toBeUndefined();
    const harvest = JSON.parse(readFileSync(join(kitDir(state.slug), "harvest.json"), "utf8"));
    expect(harvest.website.ok).toBe(true);
    expect(harvest.website.socials.length).toBeGreaterThan(0);
    const page = readFileSync(join(kitDir(state.slug), "index.html"), "utf8");
    expect(page).toContain("Bloom");
  }, 40_000);

  test("a corrupt kit.json does not crash loadKit (dashboard stays up)", () => {
    const slug = "zz-corrupt-test-kit";
    createdSlugs.push(slug);
    mkdirSync(kitDir(slug), { recursive: true });
    writeFileSync(join(kitDir(slug), "kit.json"), "{ this is not ] valid json");
    expect(loadKit(slug)).toBeNull(); // returns null instead of throwing
  });
});
