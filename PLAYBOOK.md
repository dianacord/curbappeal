# The CurbAppeal Playbook

How to turn kits into revenue. Numbers below come from the July 2026 market research in `spec/research-dossier.md`.

## The one-sentence business

You sell **done-for-you local marketing** at freelancer prices with agency polish, and your unfair advantage is that the "first meeting" artifact — audit + finished website preview + plan — costs you ~20 minutes and under a dollar to produce.

## Who to target (the "proud but invisible" segment)

Businesses that are **great offline and weak online** — the kit practically writes its own pitch:

- Google rating ≥ 4.3 with 50+ reviews (proof of quality, proof of customers)
- No website, a dead website, or a Facebook-page-as-website
- Restaurants, cafés, bakeries, salons/barbers, groomers, cleaners, repair shops
- Bonus signal: reviews that complain about *information* ("didn't know the hours", "wish I could order ahead") — those are paying-customer leaks, and the brief will surface them

Skip: franchises (no local authority to buy), businesses with agency-built sites, anything below 4.0 stars (they need reputation repair first — different service).

## The weekly rhythm (solo operator)

1. **Prospect (Mon, 1h).** Walk Google Maps in your area category by category. Collect 10 candidates that fit the profile.
2. **Generate (Mon, 1h).** Run all 10 through CurbAppeal. Skim each brief; kill weak fits. Personalize 1–2 lines if needed — the kits are good raw, better with 5 minutes of your taste.
3. **Outreach (Tue–Thu).** Use the kit's own scripts: email where you can find one, IG DM where they're active, and **walk in** for the top 3 — the walk-in script + proposal on your phone converts best for food businesses. Always lead with the preview site, not with "services."
4. **Follow-up (automatic).** Day 3 nudge, day 10 value-add goodbye (both pre-written in every kit).
5. **Close & deliver (Fri).** See fulfillment below.

Realistic funnel while you're learning: 10 kits → 6 delivered proposals → 1–2 conversations → **0.5–1 close/week**. Door-to-door + preview-in-hand outperforms cold email by a wide margin for this segment; expect email alone to close near zero at first.

## Pricing (already wired into the proposal)

| Tier | Price | What they get | Your time |
|---|---|---|---|
| **Starter** | $490 one-time | Site live on their domain + Google profile tune-up | ~3h |
| **Growth** | $890 setup + $290/mo | Starter + 8–12 posts/mo + review responses | ~3h + 2h/mo |
| **Partner** | $1,490 setup + $490/mo | Growth + promos/menus, monthly report, priority | ~4h + 4h/mo |

Why these numbers work (see dossier): freelance site builds run **$1.5k–8k**; lean social management runs **$300–1,500/mo**; DIY AI builders ($9–22/mo) anchor the "cheap" end but require the owner to do the work — your pitch is *"agency outcome, without agency prices or DIY homework."* Adjust in `config.json` (LATAM markets: consider ~40–60% of these numbers, still excellent margins).

**Unit economics per Growth client, year one:** revenue ≈ $890 + 12×$290 = **$4,370**. Cost: <$1 of API per kit revision, ~$12 domain, $0 hosting (below), your hours. Ten Growth clients ≈ **$43k/yr** on roughly two working days per week — and month-13 renewals are nearly pure margin.

## Fulfillment: making the preview real (5 minutes)

The generated site is a self-contained folder — no build step, no server:

1. Download the kit zip → unzip.
2. Go to **Netlify Drop** (app.netlify.com/drop) → drag the kit folder in → live URL instantly (free).
3. Close the sale → buy their domain (~$12) → point it at the site (Netlify handles HTTPS).
4. Google Business Profile: claim/verify with the owner, fix hours/photos/menu link, add the site URL.
5. Growth tier: schedule the kit's 2-week calendar (Meta Business Suite is free for IG+FB), then keep the cadence. Ask the owner for 10 phone photos using the kit's shot directions.

**Socials access (post-sale):** never scrape — get invited. Owner adds you in Meta Business Suite / shares TikTok access. Now you post as them, legitimately.

## Objection handling

- *"My nephew handles our Instagram."* — "Perfect, keep him! The site and Google profile are the part nephews never want to touch — that's the piece I take off your plate."
- *"I don't need a website, everyone finds us."* — Open their Google listing next to a competitor's with a site + menu link. "88% of people read reviews and look for exactly this before choosing. You're winning the food and losing the search."
- *"How much?"* (early) — "Depends what you want handled — the one-pager shows three flavors. Most places your size pick the middle one."
- *"AI made this, right?"* — "AI is one of my tools, same as a camera. What you're paying for is that it's *done*, it's *right*, and someone local answers when you text."
- Silence — the day-10 follow-up gives two free actionable tips and leaves the door open. Some close months later; the preview link keeps working for you.

## Ethics & legal guardrails (they're also good sales)

- Everything researched is **public**: their Google listing, their own website, handles customers mention. Say so proudly when asked.
- The preview is a **concept you built as a portfolio pitch** for them. If an owner wants it taken down, take it down immediately and graciously.
- Don't imply Google or the platforms endorse you. Attribute review quotes ("via Google Reviews" is baked into the templates).
- Deliver what the tiers promise; this model lives on small-town reputation.

## Scaling paths (after ~10 clients)

1. **Raise prices.** At 4.9★ testimonials of your own, Starter $750 / Growth $1,200+$390 is normal.
2. **Niche down** ("websites for taquerías", "for groomers") — referrals compound inside a niche.
3. **Productize onboarding**: a fixed-price "Local Launch Week."
4. **Hire the calendar out**: a VA runs posting from the kits; you keep sales + client care.
5. **White-label to other freelancers** — CurbAppeal is your private tooling edge; the `agency` block in config.json rebrands every proposal.
