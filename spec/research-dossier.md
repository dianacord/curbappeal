# Research dossier — market & technical (July 2026)

Compiled during Phase 1 (web research, 2026-07-18/19). Feeds README, PLAYBOOK, and the proposal template.

## Competitive landscape: DIY AI site builders

Verified entry pricing as of mid-2026: Framer from $5/mo, Mixo from $9–16/mo, 10Web from $10/mo, Durable from $12/mo (Launch plan $22/mo yearly — custom domain, CRM, invoicing, local SEO), Webflow from $14/mo, Wix/Appy Pie from $16–17/mo (Wix full range $17–159/mo). Positioning: these are *tools the owner must operate*. CurbAppeal's operator sells the *outcome*. DIY pricing is the objection anchor, not the competition.

Sources: appypie.com/blog/best-ai-website-builders · superframeworks.com/articles/best-ai-website-builders · webzum.com/blog/cheapest-ai-website-builder-2026 · app.mixo.io/pricing · max-productive.ai/ai-tools/durable

## Human-service pricing (what the market pays)

- Small-business website, freelance: **$1,500–$8,000/project** (typical "quality" band $2k–8k; hourly $50–150).
- Social media management: lean SMB packages **$300–1,500/mo** (freelance); broader outsourced range $500–5,000+/mo; basic posting starts $300–500/mo.
- Hourly SMM: entry $15–25, mid $25–50, senior $50–100.

→ CurbAppeal tiers ($490 / $890+$290 / $1,490+$490) undercut human agencies 60–90% while reading as "real" against DIY tools.

Sources: jim.com/blog/small-business-website-cost · digitalapplied.com/blog/website-development-cost-2026-complete-pricing-data · solidgigs.com/blog/freelance-social-media-manager-rates · mysocial.io/blog/social-media-management-pricing-guide · boomp.net/blog/freelance-social-media-manager-charge-cost

## Proposal ammunition (cited stats)

- **97%** of people research local businesses online; 80% of US consumers search local weekly (BrightLocal local SEO statistics).
- **88%** read Google reviews before choosing a local business; 64% check reviews before visiting (BrightLocal).
- Complete Google Business Profile → consumers **2.7× more likely** to consider the business reputable, **70% more likely to visit**, 50% more likely to purchase (Google's own data, widely republished).
- **53%** see the Google Business Profile before ever reaching a website (thestacc.com GBP statistics).
- **76%** of nearby-intent searchers visit a business within 24h; **78%** of local mobile searches end in an offline purchase (Think with Google, via biziq/local search stats roundups).

Sources: brightlocal.com/resources/local-seo-statistics · thestacc.com/blog/gbp-statistics · biziq.com/blog/local-search-statistics · seoprofy.com/blog/local-seo-statistics

## Google Places API (New) — technical

- Details: `GET https://places.googleapis.com/v1/places/{PLACE_ID}` with headers `X-Goog-Api-Key` + `X-Goog-FieldMask` (mask mandatory, no spaces). Text search: `POST .../v1/places:searchText` with `textQuery` (+ optional `locationBias` circle).
- **SKU tiers bill by the highest-tier field requested.** displayName=Pro; rating/reviews/websiteUri/hours/priceLevel/editorialSummary=Enterprise(+Atmosphere); photos=Essentials. Free monthly calls: **10k Essentials / 5k Pro / 1k Enterprise** (replaced the old $200 credit). One details call per kit → free tier covers ~1,000 kits/month.
- Photo bytes: `GET /v1/{photos[i].name}/media?maxWidthPx=...&key=...`.
- ToS: `place_id` cacheable indefinitely; lat/lng and other content max **30 consecutive days**; display Google attribution and don't obscure it; review content shown publicly should be attributed.
- Short links (`maps.app.goo.gl`) expand via redirect to a URL containing `/maps/place/<name>/@lat,lng` — parse then re-find via searchText with locationBias (robust, ToS-clean).

Sources: developers.google.com/maps/documentation/places/web-service/place-details · developers.google.com/maps/billing-and-pricing/pricing · cloud.google.com/maps-platform/terms/maps-service-terms · developers.google.com/maps/documentation/places/web-service/policies

## Social platforms — fetch reality (2026)

- Instagram Basic Display API **shut down Dec 4, 2024**; 2026 official APIs only cover accounts that authorize you (Business/Creator via Graph API). No-login public profile fetch is blocked by login walls, GraphQL obfuscation, and aggressive IP flagging; "working" scrapers are paid proxy services (e.g. Apify ~$1.50/1k results) in ToS gray/black territory.
- Product decision: **link + audit, never scrape.** Handles discovered from the business website and review-text mentions; staleness inferred from review language; owner grants real access post-sale via Meta Business Suite.

Sources: sociavault.com/blog/instagram-api-deprecated-alternative-2026 · scrapfly.io/blog/posts/how-to-scrape-instagram · storrito.com/resources/Instagram-API-2026 · socialcrawl.dev/blog/instagram-scraping-2026

## LLM economics (per kit)

5 generation calls/kit (brief, page, posts, proposal, outreach). At Opus 4.8 ($5/$25 per MTok), a kit ≈ 15–40k in / 6–12k out ≈ **$0.15–0.75**. Sonnet 5 ($3/$15, intro $2/$10 through 2026-08-31) roughly halves that. CLI mode: $0 marginal (Claude plan usage). Against a $490+ sale, model cost is noise.
