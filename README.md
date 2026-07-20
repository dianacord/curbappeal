# CurbAppeal 🏪

**Paste a storefront → get a pitch-ready brand.**

CurbAppeal is a local tool for freelance marketers. Give it a Google Maps link, place ID, or a business name — it researches the business (Google profile, reviews, website, social handles) and generates a complete, sellable **pitch kit**:

| Deliverable | File | What it's for |
|---|---|---|
| Brand brief | `brief.md` | Your audit: vibe, strengths, gaps, pull-quotes |
| Landing page | `index.html` + `assets/` | A finished one-page site, ready to deploy |
| Content calendar | `posts.md` | 2 weeks of ready-to-post social content |
| Sales proposal | `proposal.html` | Printable one-pager with audit + pricing tiers |
| Outreach scripts | `outreach.md` | Cold email, DM, walk-in script, follow-ups |
| The whole kit | `kit.zip` | Everything above, zipped to send |

The sales trick baked into the product: **you show up having already done the work.** The proposal's centerpiece is "we already built your website — want to see it?"

---

## Quickstart (60 seconds)

```bash
# 1. Install Bun (once) — https://bun.sh
curl -fsSL https://bun.sh/install | bash

# 2. Run
cd curbappeal
bun install
bun start        # → http://localhost:4747
```

Open http://localhost:4747, type **La Vecina Café** (a built-in demo business), pick a tone, hit **Generate kit**.

> **Want an instant, offline demo?** If you're logged into Claude Code, the default run uses it (real, but 1–3 min/kit). For a fast deterministic tour with zero waiting, start with `CURBAPPEAL_LLM_MODE=mock CURBAPPEAL_PLACES_MODE=fixture bun start` — kits generate in under a second with canned content.

**No API keys are required to start.** CurbAppeal auto-detects what you have:

| Mode | How it's picked | What it means |
|---|---|---|
| AI: `api` | `ANTHROPIC_API_KEY` set | Anthropic API with structured outputs (most robust) |
| AI: `cli` | you're logged into Claude Code (`claude` CLI on PATH) | Generation runs through your existing Claude subscription |
| AI: `mock` | neither | Deterministic demo content, fully offline |
| Places: `live` | `GOOGLE_PLACES_API_KEY` set | Research **any real business** |
| Places: `demo` | no Google key | Only the built-in fictional demo businesses |

Current modes are shown as chips in the app header and at `/api/health`.

## Going live (research real businesses)

1. Create a Google Cloud project → enable **Places API (New)**.
2. Create an API key (restrict it to Places API).
3. `cp .env.example .env` and set `GOOGLE_PLACES_API_KEY=...`
4. Restart. Paste any Maps link / business name.

Pricing reality: Google's free tier gives ~1,000 free "Enterprise" SKU calls/month (the tier that includes reviews + website fields). CurbAppeal makes **one** details call per kit and caches it on disk, so even a heavy week of prospecting stays comfortably free. Photos add one Essentials-tier call each (10k free/month).

## Make it yours

Edit `config.json`:

- `agency` — your name/brand/contact; lands on every proposal.
- `pricing` — your three tiers; proposal + playbook use these numbers.
- `model` / `cliModel` — Claude model for api / cli mode (default `claude-opus-4-8`; use `claude-sonnet-5` to cut cost ~40%).

Spanish-market ready: set copy language to **Español** (or Auto) — the entire kit, proposal included, renders in Spanish. (This runs in `api`/`cli` mode; the offline `mock` demo content is English-only.)

## Architecture (for the curious)

```
src/
  server.ts     Bun.serve router (no framework)
  ui.ts         operator UI (server-rendered, tiny inline JS)
  pipeline.ts   8 stages: resolve → harvest → brief → page → posts
                → proposal → outreach → package; state in kits/<slug>/kit.json
  llm.ts        tri-mode client (Anthropic SDK / headless claude CLI / mock)
  sources.ts    Maps-link parsing, Places API (New) v1, website harvest
  templates.ts  deterministic renderers — LLM writes copy, never HTML
  config.ts     config.json + env + mode detection
fixtures/       fictional demo businesses (safe to publish)
kits/           generated output (gitignored)
```

Design choices that matter:

- **LLM writes JSON copy; templates write HTML.** Every model-produced string is HTML-escaped at render time. Generated sites contain zero JavaScript.
- **Harvested web content is treated as untrusted** — wrapped and flagged in prompts, escaped in output (see `fixtures/sites/hostile.html` and the test suite).
- **Kits are plain folders.** Everything is inspectable; `kit.zip` is the client deliverable; failed runs resume from the failed stage.
- Kit files are served only from within the kit directory, with an extension allowlist and a strict CSP on previews.

## Tests

```bash
bun test   # helpers, harvesting, XSS resistance, full offline pipeline E2E
```

## Honest limitations

- **No Instagram/TikTok scraping.** Public no-login access was shut down by the platforms (2024–2026); scraping now requires ToS-violating paid proxies. CurbAppeal finds social handles (website links + review mentions), flags staleness signals from review text, and the playbook covers getting owner access post-sale — the sustainable version of "stalking."
- **No image generation.** Kits use the business's real Google photos (live mode) or tasteful placeholder art; every social post includes a one-line photo direction the owner can shoot on a phone.
- **Google data rules**: place IDs may be cached forever, other place data max 30 days — regenerate stale kits before pitching (a kit is a point-in-time snapshot anyway). Review quotes shown publicly are attributed to Google Reviews in every template.
- `cli` mode consumes your Claude plan usage; `api` mode costs roughly $0.15–0.75 per kit at Opus 4.8 rates (less on Sonnet).

## Selling with it

Read **PLAYBOOK.md** — niche selection, the outreach cadence, pricing rationale, unit economics, 5-minute site deployment (Netlify Drop), and objection handling.
