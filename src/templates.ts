// Deterministic renderers. The LLM supplies copy (plain text, JSON);
// these templates supply all structure and style. Every dynamic string is escaped.
import { config, money, type Pricing } from "./config";
import { esc, hexColor, todayLong } from "./util";
import type { PlaceRecord } from "./sources";
import type { KitState } from "./pipeline";

// ---------- shared bits ----------

export interface PageCopy {
  template: "warm" | "modern" | "bold";
  accent: string;
  headline: string;
  subheadline: string;
  badge_line: string;
  about_heading: string;
  about_text: string;
  menu_heading: string;
  menu_items: { name: string; desc: string; price?: string }[];
  testimonials: { quote: string; author: string }[];
  cta_heading: string;
  cta_text: string;
  cta_button: string;
  footer_line: string;
  labels: { hours: string; call: string; directions: string; reviews: string };
}

function telHref(phone?: string): string {
  const digits = (phone ?? "").replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

function safeHttpUrl(url?: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function stars(rating?: number): string {
  if (!rating) return "";
  const full = Math.round(rating);
  return "★".repeat(Math.min(5, full)) + "☆".repeat(Math.max(0, 5 - full));
}

// ---------- landing page ----------

const PAGE_THEMES = {
  warm: (a: string) => `
    :root { --accent:${a}; --bg:#faf4ea; --ink:#3b2a20; --card:#fffaf2; --muted:#8a7562; }
    body { font-family: Georgia, 'Times New Roman', serif; }
    h1,h2,h3 { font-weight: 600; letter-spacing: -.01em; }
    .hero { border-radius: 0 0 42px 42px; }
    .card { border-radius: 20px; box-shadow: 0 10px 30px rgba(59,42,32,.08); }
    .btn { border-radius: 999px; }
    .badge { border-radius: 999px; background: var(--card); }`,
  modern: (a: string) => `
    :root { --accent:${a}; --bg:#101014; --ink:#f2f2f0; --card:#1a1a20; --muted:#9a9aa4; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    h1,h2,h3 { font-weight: 650; letter-spacing: -.03em; }
    .hero { border-bottom: 1px solid #26262e; }
    .card { border-radius: 14px; border: 1px solid #26262e; }
    .btn { border-radius: 10px; }
    .badge { border-radius: 8px; background: var(--card); border: 1px solid #26262e; }`,
  bold: (a: string) => `
    :root { --accent:${a}; --bg:#fdfdf6; --ink:#101010; --card:#ffffff; --muted:#4c4c46; }
    body { font-family: 'Avenir Next', 'Helvetica Neue', Arial, sans-serif; }
    h1,h2,h3 { font-weight: 800; text-transform: uppercase; letter-spacing: .01em; }
    .hero { border-bottom: 4px solid var(--ink); }
    .card { border-radius: 4px; border: 3px solid var(--ink); box-shadow: 8px 8px 0 var(--accent); }
    .btn { border-radius: 4px; border: 3px solid var(--ink); box-shadow: 4px 4px 0 var(--ink); }
    .badge { border-radius: 4px; background: var(--card); border: 2px solid var(--ink); }`,
} as const;

export function renderLandingPage(page: PageCopy, place: PlaceRecord, photoFiles: string[]): string {
  const theme = PAGE_THEMES[page.template] ?? PAGE_THEMES.warm;
  const accent = hexColor(page.accent, "#c2542e");
  const name = esc(place.displayName?.text ?? page.headline);
  const phone = telHref(place.internationalPhoneNumber);
  const maps = safeHttpUrl(place.googleMapsUri);
  const heroPhoto = photoFiles[0] ? esc(photoFiles[0]) : "";
  const hours = place.regularOpeningHours?.weekdayDescriptions ?? [];
  const labels = page.labels ?? { hours: "Hours", call: "Call", directions: "Directions", reviews: "Google reviews" };

  const menuRows = (page.menu_items ?? []).map((m) => `
      <div class="card item">
        <div class="item-head"><h3>${esc(m.name)}</h3>${m.price ? `<span class="price">${esc(m.price)}</span>` : ""}</div>
        <p>${esc(m.desc)}</p>
      </div>`).join("");

  const quoteCards = (page.testimonials ?? []).map((t) => `
      <figure class="card quote">
        <blockquote>“${esc(t.quote)}”</blockquote>
        <figcaption>— ${esc(t.author)} · <span class="via">${esc(labels.reviews)}</span></figcaption>
      </figure>`).join("");

  const hoursRows = hours.map((h) => {
    const [day, ...rest] = h.split(": ");
    return `<div class="hrow"><span>${esc(day)}</span><span>${esc(rest.join(": "))}</span></div>`;
  }).join("");

  const gallery = photoFiles.slice(1, 3).map((p) => `<img src="${esc(p)}" alt="${name}" loading="lazy">`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<meta name="description" content="${esc(page.subheadline)}">
<style>
* { margin:0; padding:0; box-sizing:border-box; }
${theme(accent)}
body { background:var(--bg); color:var(--ink); line-height:1.6; }
.wrap { max-width: 980px; margin: 0 auto; padding: 0 22px; }
header.top { display:flex; justify-content:space-between; align-items:center; padding:18px 0; }
.brand { font-size:1.05rem; font-weight:700; }
.btn { display:inline-block; background:var(--accent); color:#fff; padding:.7em 1.35em; text-decoration:none; font-weight:700; }
.btn.ghost { background:transparent; color:var(--ink); border:2px solid var(--ink); box-shadow:none; }
.hero { padding: 72px 0 64px; position:relative; overflow:hidden;
  ${heroPhoto
    ? `background: linear-gradient(rgba(0,0,0,.45), rgba(0,0,0,.55)), url('${heroPhoto}') center/cover;`
    : `background: linear-gradient(135deg, ${accent}, ${accent}cc 55%, ${accent}88);`} }
.hero .wrap { color:#fff; max-width:820px; text-align:center; }
.hero h1 { font-size: clamp(2.4rem, 6vw, 4rem); line-height:1.08; margin-bottom:.35em; }
.hero p.sub { font-size: clamp(1.05rem, 2.4vw, 1.35rem); opacity:.94; margin-bottom:1.4em; }
.badge { display:inline-block; color:var(--ink); padding:.5em 1.1em; font-weight:700; font-size:.95rem; }
.hero .badge { background:#fff; }
section { padding: 58px 0; }
section h2 { font-size: clamp(1.5rem, 3.4vw, 2.1rem); margin-bottom:.8em; color:var(--ink); }
.about p { max-width: 640px; font-size:1.08rem; color:var(--ink); opacity:.92; }
.grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:18px; }
.card { background:var(--card); padding:22px; }
.item-head { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:.35em; }
.item p { color:var(--muted); font-size:.98rem; }
.price { color:var(--accent); font-weight:800; white-space:nowrap; }
.quote blockquote { font-size:1.02rem; margin-bottom:.8em; }
.quote figcaption { color:var(--muted); font-size:.9rem; }
.via { opacity:.85; }
.gallery { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:26px; }
.gallery img { width:100%; height:230px; object-fit:cover; border-radius:14px; }
.split { display:grid; grid-template-columns: 1.1fr .9fr; gap:34px; align-items:start; }
.hrow { display:flex; justify-content:space-between; padding:.45em 0; border-bottom:1px dashed var(--muted); font-size:.98rem; }
.cta-card { text-align:center; padding:44px 26px; }
.cta-card h2 { margin-bottom:.4em; }
.cta-card p { color:var(--muted); margin-bottom:1.3em; }
.cta-actions { display:flex; gap:14px; justify-content:center; flex-wrap:wrap; }
footer { padding: 30px 0 44px; color:var(--muted); font-size:.9rem; text-align:center; }
@media (max-width: 720px){ .split { grid-template-columns:1fr; } .gallery{grid-template-columns:1fr;} }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <span class="brand">${name}</span>
    ${phone ? `<a class="btn" href="${phone}">${esc(labels.call)}</a>` : ""}
  </header>
</div>
<div class="hero">
  <div class="wrap">
    <span class="badge">${esc(page.badge_line)}</span>
    <h1 style="margin-top:.6em">${esc(page.headline)}</h1>
    <p class="sub">${esc(page.subheadline)}</p>
    ${maps ? `<a class="btn" href="${esc(maps)}">${esc(labels.directions)}</a>` : ""}
  </div>
</div>
<div class="wrap">
  <section class="about">
    <h2>${esc(page.about_heading)}</h2>
    <p>${esc(page.about_text)}</p>
    ${gallery ? `<div class="gallery">${gallery}</div>` : ""}
  </section>
  <section>
    <h2>${esc(page.menu_heading)}</h2>
    <div class="grid">${menuRows}</div>
  </section>
  <section>
    <h2>${stars(place.rating)} ${esc(page.badge_line)}</h2>
    <div class="grid">${quoteCards}</div>
  </section>
  <section class="split">
    <div class="card cta-card" style="text-align:left">
      <h2>${esc(labels.hours)}</h2>
      ${hoursRows || `<p>${esc(page.cta_text)}</p>`}
    </div>
    <div class="card cta-card">
      <h2>${esc(page.cta_heading)}</h2>
      <p>${esc(page.cta_text)}</p>
      <div class="cta-actions">
        ${phone ? `<a class="btn" href="${phone}">${esc(labels.call)}</a>` : ""}
        ${maps ? `<a class="btn ghost" href="${esc(maps)}">${esc(labels.directions)}</a>` : ""}
      </div>
    </div>
  </section>
</div>
<footer>${esc(page.footer_line)}</footer>
</body>
</html>`;
}

// ---------- proposal ----------

export interface ProposalCopy {
  opening_line: string;
  audit_findings: { label: string; status: "good" | "warn" | "bad"; note: string }[];
  quote_pull: { quote: string; author: string };
  opportunity_paragraph: string;
  tier_recommendation: "starter" | "growth" | "partner";
  tiers_pitch: { starter: string; growth: string; partner: string };
  why_now_paragraph: string;
  next_step_paragraph: string;
}

const PROPOSAL_LABELS: Record<string, Record<string, string>> = {
  en: {
    doc: "Marketing Snapshot & Proposal", prepared: "Prepared for", by: "by", found: "What we found",
    saying: "What your customers already say", built: "We already built your preview",
    builtNote: "A complete, ready-to-launch website for your business is included with this proposal — ask to see it on the spot, or find it in the attached files (index.html).",
    plan: "The plan", recommended: "Recommended", whynow: "Why now", next: "Your next step",
    setup: "setup", month: "/month", onetime: "one-time",
    starter: "Starter", growth: "Growth", partner: "Partner",
    stats: "97% of consumers research local businesses online (BrightLocal, 2026) · 88% read Google reviews before choosing (BrightLocal) · Complete Google profiles get 70% more visits (Google) · 76% of nearby searchers visit a business within 24 hours (Think with Google)",
  },
  es: {
    doc: "Diagnóstico de Marketing y Propuesta", prepared: "Preparado para", by: "por", found: "Lo que encontramos",
    saying: "Lo que ya dicen tus clientes", built: "Ya construimos tu página",
    builtNote: "Esta propuesta incluye un sitio web completo y listo para lanzar — pide verlo en el momento, o ábrelo en los archivos adjuntos (index.html).",
    plan: "El plan", recommended: "Recomendado", whynow: "Por qué ahora", next: "Tu siguiente paso",
    setup: "instalación", month: "/mes", onetime: "pago único",
    starter: "Inicial", growth: "Crecimiento", partner: "Socio",
    stats: "97% de los consumidores investigan negocios locales en línea (BrightLocal, 2026) · 88% lee reseñas de Google antes de elegir (BrightLocal) · Los perfiles de Google completos reciben 70% más visitas (Google) · 76% de quienes buscan \"cerca de mí\" visitan en 24 horas (Think with Google)",
  },
};

export function renderProposal(proposal: ProposalCopy, place: PlaceRecord, state: KitState, lang = "en"): string {
  const L = PROPOSAL_LABELS[lang] ?? PROPOSAL_LABELS.en;
  const name = esc(place.displayName?.text ?? "Your business");
  const accent = hexColor(state.accent, "#b4552d");
  const a = config.agency;
  const p: Pricing = config.pricing;
  const statusIcon = { good: "✓", warn: "△", bad: "✕" } as const;
  const statusColor = { good: "#2c7a4b", warn: "#b97e0e", bad: "#b3372e" } as const;

  const findings = (proposal.audit_findings ?? []).map((f) => `
    <tr>
      <td class="st" style="color:${statusColor[f.status] ?? "#555"}">${statusIcon[f.status] ?? "·"}</td>
      <td class="lb">${esc(f.label)}</td>
      <td>${esc(f.note)}</td>
    </tr>`).join("");

  const tiers: { key: "starter" | "growth" | "partner"; price: string }[] = [
    { key: "starter", price: `${money(p.starter.setup)} <span class="small">${L.onetime}</span>` },
    { key: "growth", price: `${money(p.growth.setup)} <span class="small">${L.setup}</span> + ${money(p.growth.monthly)}<span class="small">${L.month}</span>` },
    { key: "partner", price: `${money(p.partner.setup)} <span class="small">${L.setup}</span> + ${money(p.partner.monthly)}<span class="small">${L.month}</span>` },
  ];

  const tierCards = tiers.map((t) => `
    <div class="tier ${proposal.tier_recommendation === t.key ? "rec" : ""}">
      ${proposal.tier_recommendation === t.key ? `<span class="rec-tag">${L.recommended}</span>` : ""}
      <h3>${L[t.key]}</h3>
      <div class="price">${t.price}</div>
      <p>${esc(proposal.tiers_pitch?.[t.key] ?? "")}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="${esc(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name} — ${L.doc}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
:root { --accent:${accent}; --ink:#20211f; --muted:#6d6e6a; --line:#e4e1da; }
body { font-family: Georgia, 'Times New Roman', serif; color:var(--ink); background:#f2f0ea; line-height:1.55; }
.page { max-width: 820px; margin: 28px auto; background:#fffefb; padding: 56px 60px; box-shadow: 0 8px 40px rgba(0,0,0,.1); }
.mast { display:flex; justify-content:space-between; align-items:baseline; border-bottom:3px solid var(--accent); padding-bottom:14px; margin-bottom:30px; }
.mast .agency { font-weight:700; font-size:1.05rem; }
.mast .doc { color:var(--muted); font-size:.9rem; font-style:italic; }
h1 { font-size:1.9rem; line-height:1.15; margin:.2em 0 .3em; }
.meta { color:var(--muted); font-size:.92rem; margin-bottom:26px; }
.open { font-size:1.08rem; margin-bottom:26px; }
h2 { font-size:1.15rem; text-transform:uppercase; letter-spacing:.08em; color:var(--accent); margin:30px 0 12px; }
table { width:100%; border-collapse:collapse; font-size:.95rem; }
td { padding:.55em .6em; border-bottom:1px solid var(--line); vertical-align:top; }
td.st { width:1.8em; font-weight:800; }
td.lb { width:11.5em; font-weight:700; }
.pull { border-left:4px solid var(--accent); padding:.6em 1.1em; font-size:1.12rem; font-style:italic; margin:10px 0; }
.pull .who { display:block; font-size:.85rem; font-style:normal; color:var(--muted); margin-top:.5em; }
.built { background:#faf6ec; border:1px solid var(--line); border-radius:10px; padding:16px 20px; font-size:.97rem; }
.tiers { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:8px; }
.tier { border:1px solid var(--line); border-radius:10px; padding:18px 16px; position:relative; }
.tier.rec { border:2px solid var(--accent); background:#fdf9f2; }
.rec-tag { position:absolute; top:-11px; left:14px; background:var(--accent); color:#fff; font-size:.7rem; letter-spacing:.06em; text-transform:uppercase; padding:2px 10px; border-radius:99px; font-family: sans-serif; }
.tier h3 { font-size:1.02rem; margin-bottom:.3em; }
.tier .price { font-weight:800; font-size:1.06rem; margin-bottom:.5em; }
.tier .small { font-weight:400; font-size:.78rem; color:var(--muted); }
.tier p { font-size:.88rem; color:var(--muted); }
.stats { font-size:.8rem; color:var(--muted); border-top:1px solid var(--line); margin-top:14px; padding-top:10px; }
.sig { margin-top:34px; display:flex; justify-content:space-between; align-items:flex-end; }
.sig .who { font-weight:700; }
.sig .contact { color:var(--muted); font-size:.9rem; text-align:right; }
@media print {
  body { background:#fff; }
  .page { box-shadow:none; margin:0; padding: 24px 8px; max-width:100%; }
  .tiers { grid-template-columns:repeat(3,1fr); }
  @page { margin: 16mm; }
}
@media (max-width: 700px){ .page { padding: 30px 22px; } .tiers { grid-template-columns:1fr; } .sig { flex-direction:column; align-items:flex-start; gap:10px; } .sig .contact{ text-align:left; } }
</style>
</head>
<body>
<div class="page">
  <div class="mast">
    <span class="agency">${esc(a.name)}</span>
    <span class="doc">${L.doc} · ${esc(todayLong(lang === "es" ? "es-MX" : "en-US"))}</span>
  </div>
  <div class="meta">${L.prepared}</div>
  <h1>${name}</h1>
  <div class="meta">${esc(place.formattedAddress ?? "")}</div>
  <p class="open">${esc(proposal.opening_line)}</p>

  <h2>${L.found}</h2>
  <table>${findings}</table>

  <h2>${L.saying}</h2>
  <div class="pull">“${esc(proposal.quote_pull?.quote ?? "")}”<span class="who">— ${esc(proposal.quote_pull?.author ?? "")} · Google Reviews</span></div>
  <p>${esc(proposal.opportunity_paragraph)}</p>

  <h2>${L.built}</h2>
  <div class="built">${L.builtNote}</div>

  <h2>${L.plan}</h2>
  <div class="tiers">${tierCards}</div>

  <h2>${L.whynow}</h2>
  <p>${esc(proposal.why_now_paragraph)}</p>
  <p class="stats">${L.stats}</p>

  <h2>${L.next}</h2>
  <p>${esc(proposal.next_step_paragraph)}</p>

  <div class="sig">
    <div>
      <div class="who">${esc(a.owner)}</div>
      <div>${esc(a.name)}</div>
    </div>
    <div class="contact">${esc(a.email)}${a.phone ? `<br>${esc(a.phone)}` : ""}${a.city ? `<br>${esc(a.city)}` : ""}</div>
  </div>
</div>
</body>
</html>`;
}

// ---------- markdown deliverables ----------

export function renderBriefMd(brief: Record<string, unknown>, place: PlaceRecord): string {
  const b = brief as {
    business_summary: string; vibe_words: string[]; strengths: { title: string; detail: string }[];
    gaps: { title: string; detail: string; severity: string }[]; target_customer: string;
    tone_recommendation: string; accent_color: string; language: string;
    review_pull_quotes: { quote: string; author: string }[]; opportunity_headline: string;
  };
  const name = place.displayName?.text ?? "Business";
  return [
    `# Brand brief — ${name}`,
    ``,
    `> ${b.opportunity_headline}`,
    ``,
    `**Summary.** ${b.business_summary}`,
    ``,
    `**Vibe:** ${(b.vibe_words ?? []).join(" · ")}`,
    `**Target customer:** ${b.target_customer}`,
    `**Recommended tone:** ${b.tone_recommendation} · **Accent:** ${b.accent_color} · **Copy language:** ${b.language}`,
    ``,
    `## Strengths`,
    ...(b.strengths ?? []).map((x) => `- **${x.title}** — ${x.detail}`),
    ``,
    `## Gaps (the pitch writes itself)`,
    ...(b.gaps ?? []).map((x) => `- **[${x.severity}] ${x.title}** — ${x.detail}`),
    ``,
    `## Quotes worth quoting (via Google Reviews)`,
    ...(b.review_pull_quotes ?? []).map((q) => `- “${q.quote}” — ${q.author}`),
    ``,
  ].join("\n");
}

export function renderPostsMd(posts: { posts: { day: string; platform: string; caption: string; hashtags: string[]; image_direction: string; cta: string }[] }, place: PlaceRecord): string {
  const name = place.displayName?.text ?? "Business";
  const rows = (posts.posts ?? []).map((p) => [
    `### ${p.day} — ${p.platform}`,
    ``,
    `${p.caption}`,
    ``,
    `${(p.hashtags ?? []).join(" ")}`,
    ``,
    `📸 *Shot:* ${p.image_direction}`,
    `👉 *CTA:* ${p.cta}`,
    ``,
  ].join("\n"));
  return [`# 2-week content calendar — ${name}`, ``, ...rows].join("\n");
}

export function renderOutreachMd(o: { email_subject_options: string[]; email_body: string; dm_body: string; walkin_script: string; followup_1: string; followup_2: string }, place: PlaceRecord): string {
  const name = place.displayName?.text ?? "Business";
  return [
    `# Outreach scripts — ${name}`,
    ``,
    `## Cold email`,
    ...(o.email_subject_options ?? []).map((sub, i) => `**Subject ${i + 1}:** ${sub}`),
    ``,
    o.email_body,
    ``,
    `## Instagram DM`,
    o.dm_body,
    ``,
    `## Walk-in (30 seconds)`,
    o.walkin_script,
    ``,
    `## Follow-up, day 3`,
    o.followup_1,
    ``,
    `## Follow-up, day 10`,
    o.followup_2,
    ``,
  ].join("\n");
}
