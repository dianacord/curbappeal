// Operator-facing UI (server-rendered, tiny inline JS for polling/tabs).
import { config, type LlmMode, type PlacesMode } from "./config";
import { esc } from "./util";
import { STAGE_ORDER, type KitState } from "./pipeline";

const BASE_CSS = `
* { margin:0; padding:0; box-sizing:border-box; }
:root { --bg:#0e0d0b; --panel:#171512; --panel2:#1e1b17; --ink:#f4efe7; --muted:#9c948a; --line:#2a261f;
        --accent:#e0743c; --accent2:#f2b24e; --good:#68b984; --bad:#e06c5c; --warn:#e0b04e; }
body { background:var(--bg); color:var(--ink); font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height:1.55; min-height:100vh; }
a { color:inherit; }
.wrap { max-width:1000px; margin:0 auto; padding:0 24px; }
header.app { display:flex; align-items:center; justify-content:space-between; padding:20px 0; }
.logo { display:flex; align-items:center; gap:10px; font-weight:800; font-size:1.15rem; letter-spacing:-.02em; text-decoration:none; }
.logo .awning { width:26px; height:26px; border-radius:6px; background:repeating-linear-gradient(90deg, var(--accent) 0 6px, var(--accent2) 6px 12px); position:relative; }
.chips { display:flex; gap:8px; }
.chip { font-size:.72rem; letter-spacing:.05em; text-transform:uppercase; padding:4px 10px; border-radius:99px; border:1px solid var(--line); color:var(--muted); }
.chip.hot { border-color:var(--accent); color:var(--accent2); }
.hero { text-align:center; padding:52px 0 30px; }
.hero h1 { font-size:clamp(1.9rem, 4.6vw, 3rem); letter-spacing:-.03em; line-height:1.1; }
.hero h1 em { font-style:normal; background:linear-gradient(90deg, var(--accent), var(--accent2)); -webkit-background-clip:text; background-clip:text; color:transparent; }
.hero p { color:var(--muted); margin-top:12px; font-size:1.05rem; }
.card { background:var(--panel); border:1px solid var(--line); border-radius:16px; padding:22px; }
form.gen { max-width:760px; margin:26px auto; display:flex; flex-direction:column; gap:14px; }
.qrow { display:flex; gap:10px; }
input[type=text], textarea, select { background:var(--panel2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:12px 14px; font-size:1rem; font-family:inherit; width:100%; }
input[type=text]:focus, textarea:focus, select:focus { outline:2px solid var(--accent); border-color:transparent; }
button.go { background:linear-gradient(90deg, var(--accent), var(--accent2)); border:none; color:#1c1208; font-weight:800; font-size:1rem; border-radius:10px; padding:12px 26px; cursor:pointer; white-space:nowrap; }
button.go:disabled { opacity:.55; cursor:wait; }
.knobs { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; }
.knobs label { font-size:.75rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); display:block; margin-bottom:5px; }
textarea { resize:vertical; min-height:60px; }
.demo-hint { text-align:center; color:var(--muted); font-size:.88rem; }
.demo-hint a { color:var(--accent2); cursor:pointer; text-decoration:underline dotted; }
.kits { display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px; margin:30px 0 60px; }
.kit-card { display:block; text-decoration:none; transition:transform .12s ease; }
.kit-card:hover { transform:translateY(-2px); }
.kit-card h3 { font-size:1.02rem; margin-bottom:4px; }
.kit-card .meta { color:var(--muted); font-size:.85rem; }
.kit-card .accentbar { height:4px; border-radius:99px; margin-top:12px; background:linear-gradient(90deg, var(--accent), var(--accent2)); }
.err { color:var(--bad); }
.stage-list { display:flex; flex-direction:column; gap:8px; margin:18px 0; }
.stage { display:flex; align-items:center; gap:12px; padding:10px 14px; border-radius:10px; background:var(--panel2); border:1px solid var(--line); font-size:.95rem; }
.stage .dot { width:10px; height:10px; border-radius:99px; background:var(--muted); flex:none; }
.stage.done .dot { background:var(--good); }
.stage.failed .dot { background:var(--bad); }
.stage.running .dot { background:var(--accent2); animation:pulse 1s infinite alternate; }
@keyframes pulse { from { opacity:.4; } to { opacity:1; } }
.tabs { display:flex; gap:6px; flex-wrap:wrap; margin:26px 0 14px; }
.tab { border:1px solid var(--line); background:var(--panel); color:var(--muted); padding:8px 16px; border-radius:99px; cursor:pointer; font-size:.92rem; }
.tab.active { border-color:var(--accent); color:var(--ink); background:var(--panel2); }
.pane { display:none; }
.pane.active { display:block; }
iframe.preview { width:100%; height:72vh; border:1px solid var(--line); border-radius:14px; background:#fff; }
.doc { background:var(--panel); border:1px solid var(--line); border-radius:14px; padding:26px 30px; max-width:820px; }
.doc h2, .doc h3, .doc h4 { margin:1em 0 .4em; }
.doc ul { margin:.4em 0 .8em 1.2em; }
.doc p { margin:.4em 0; }
.doc blockquote { border-left:3px solid var(--accent); padding-left:12px; color:var(--muted); }
.row { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
.btn2 { display:inline-block; border:1px solid var(--line); border-radius:10px; padding:9px 18px; text-decoration:none; font-size:.92rem; background:var(--panel2); }
.btn2.primary { background:linear-gradient(90deg, var(--accent), var(--accent2)); color:#1c1208; font-weight:700; border:none; }
.notice { border:1px solid var(--warn); background:#241d10; color:var(--warn); border-radius:10px; padding:10px 16px; font-size:.9rem; margin:14px 0; }
footer.app { color:var(--muted); font-size:.8rem; text-align:center; padding:26px 0 40px; }
`;

function shell(title: string, body: string, extraJs = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${BASE_CSS}</style>
</head>
<body>
${body}
<footer class="app">CurbAppeal · pitch kits for local businesses · running locally for ${esc(config.agency.owner)}</footer>
<script>${extraJs}</script>
</body>
</html>`;
}

function headerBar(llm: LlmMode, places: PlacesMode): string {
  return `<div class="wrap"><header class="app">
    <a class="logo" href="/"><span class="awning"></span>CurbAppeal</a>
    <div class="chips">
      <span class="chip ${llm !== "mock" ? "hot" : ""}">AI: ${llm}</span>
      <span class="chip ${places === "live" ? "hot" : ""}">Places: ${places === "live" ? "live" : "demo"}</span>
    </div>
  </header></div>`;
}

export function homePage(kits: KitState[], llm: LlmMode, places: PlacesMode, demoNames: string[]): string {
  const kitCards = kits.map((k) => {
    const failed = Object.values(k.stages).includes("failed");
    const done = k.stages.package === "done";
    const status = failed ? `<span class="err">failed — click to retry</span>` : done ? "ready" : "generating…";
    return `<a class="card kit-card" href="/kit/${esc(k.slug)}">
      <h3>${esc(k.business?.name ?? k.input.query)}</h3>
      <div class="meta">${esc(k.business?.address ?? "")}</div>
      <div class="meta">${k.business?.rating ? `${esc(k.business.rating)}★ · ${esc(k.business.reviews)} reviews · ` : ""}${status}</div>
      <div class="accentbar"></div>
    </a>`;
  }).join("");

  const demoLinks = demoNames.map((n) => `<a onclick="fill('${esc(n).replaceAll("'", "\\'")}')">${esc(n)}</a>`).join(" or ");

  const body = `
${headerBar(llm, places)}
<div class="wrap">
  <div class="hero">
    <h1>Paste a storefront.<br>Get a <em>pitch-ready brand</em>.</h1>
    <p>Google Maps link, place ID, or “name, city” → brand brief, landing page, content calendar, proposal, outreach scripts.</p>
  </div>
  <form class="gen" id="genform">
    <div class="qrow">
      <input type="text" id="query" name="query" placeholder="https://maps.app.goo.gl/… or “La Vecina Café, Portland”" maxlength="500" required>
      <button class="go" type="submit" id="gobtn">Generate kit</button>
    </div>
    <div class="knobs">
      <div><label>Tone</label><select id="tone"><option value="auto">Auto (match the vibe)</option><option value="warm">Warm</option><option value="modern">Modern</option><option value="bold">Bold</option></select></div>
      <div><label>Owner's goal</label><select id="goal"><option>More foot traffic</option><option>More online orders</option><option>More bookings</option><option>More followers</option></select></div>
      <div><label>Copy language</label><select id="language"><option value="auto">Auto-detect</option><option value="en">English</option><option value="es">Español</option></select></div>
    </div>
    <textarea id="notes" placeholder="Optional notes — anything you know about the owner or what to emphasize" maxlength="600"></textarea>
    ${places === "fixture" ? `<div class="demo-hint">Demo mode (no Google key needed) — try ${demoLinks}</div>` : ""}
    <div class="err" id="formerr"></div>
  </form>
  ${kits.length ? `<h2 style="margin-top:24px">Recent kits</h2><div class="kits">${kitCards}</div>` : `<div style="height:60px"></div>`}
</div>`;

  const js = `
function fill(name){ document.getElementById('query').value = name; document.getElementById('query').focus(); }
document.getElementById('genform').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('gobtn');
  btn.disabled = true; btn.textContent = 'Starting…';
  try {
    const res = await fetch('/api/kits', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({
      query: document.getElementById('query').value,
      tone: document.getElementById('tone').value,
      goal: document.getElementById('goal').value,
      language: document.getElementById('language').value,
      notes: document.getElementById('notes').value,
    })});
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    location.href = '/kit/' + data.slug;
  } catch (err) {
    document.getElementById('formerr').textContent = err.message;
    btn.disabled = false; btn.textContent = 'Generate kit';
  }
});`;
  return shell("CurbAppeal", body, js);
}

const STAGE_LABELS: Record<string, string> = {
  resolve: "Finding the business on Google",
  harvest: "Researching website, reviews & socials",
  brief: "Writing the brand brief",
  page: "Designing the landing page",
  posts: "Drafting the content calendar",
  proposal: "Composing the sales proposal",
  outreach: "Writing outreach scripts",
  package: "Packaging the kit",
};

export function kitPage(state: KitState): string {
  const name = state.business?.name ?? state.input.query;
  const done = state.stages.package === "done";
  const failed = Object.values(state.stages).includes("failed");

  const stageRows = STAGE_ORDER.map((sName) => {
    const st = state.stages[sName];
    return `<div class="stage ${st}" data-stage="${sName}"><span class="dot"></span>${STAGE_LABELS[sName]}<span style="margin-left:auto;color:var(--muted);font-size:.8rem" class="st-label">${st}</span></div>`;
  }).join("");

  const tabs = [
    ["brief", "Brief"], ["page", "Landing page"], ["posts", "Posts"], ["proposal", "Proposal"], ["outreach", "Outreach"],
  ].map(([id, label], i) => `<button class="tab ${i === 0 ? "active" : ""}" data-tab="${id}">${label}</button>`).join("");

  const body = `
${headerBar(state.llmMode, state.placesMode)}
<div class="wrap">
  <div class="row" style="margin-top:8px">
    <div>
      <h1 style="letter-spacing:-.02em">${esc(name)}</h1>
      <div style="color:var(--muted)">${esc(state.business?.address ?? "")} ${state.business?.rating ? `· ${esc(state.business.rating)}★ (${esc(state.business.reviews)})` : ""}</div>
    </div>
    <div style="display:flex; gap:10px">
      ${failed ? `<button class="btn2" id="retrybtn">Retry</button>` : ""}
      <a class="btn2 ${done ? "primary" : ""}" id="dlbtn" href="/kit/${esc(state.slug)}/download" ${done ? "" : 'style="pointer-events:none;opacity:.5"'}>Download kit (.zip)</a>
    </div>
  </div>
  ${state.error ? `<div class="notice">⚠ ${esc(state.error)}</div>` : ""}
  <div id="progress" class="stage-list" ${done ? 'style="display:none"' : ""}>${stageRows}</div>
  <div id="content" ${done ? "" : 'style="display:none"'}>
    <div class="tabs">${tabs}</div>
    <div class="pane active" id="pane-brief"><div class="doc" id="doc-brief">Loading…</div></div>
    <div class="pane" id="pane-page">
      <div class="row" style="margin-bottom:10px"><span style="color:var(--muted);font-size:.9rem">Self-contained site — deploy the kit folder anywhere (Netlify Drop, etc.)</span>
      <a class="btn2" href="/kit/${esc(state.slug)}/file/index.html" target="_blank">Open full screen ↗</a></div>
      <iframe class="preview" src="/kit/${esc(state.slug)}/file/index.html"></iframe>
    </div>
    <div class="pane" id="pane-posts"><div class="doc" id="doc-posts">Loading…</div></div>
    <div class="pane" id="pane-proposal">
      <div class="row" style="margin-bottom:10px"><span style="color:var(--muted);font-size:.9rem">Print to PDF from the full-screen view (⌘P)</span>
      <a class="btn2" href="/kit/${esc(state.slug)}/file/proposal.html" target="_blank">Open full screen ↗</a></div>
      <iframe class="preview" src="/kit/${esc(state.slug)}/file/proposal.html"></iframe>
    </div>
    <div class="pane" id="pane-outreach"><div class="doc" id="doc-outreach">Loading…</div></div>
  </div>
</div>`;

  const js = `
const slug = ${JSON.stringify(state.slug)};
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.pane').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  document.getElementById('pane-' + t.dataset.tab).classList.add('active');
}));
const retry = document.getElementById('retrybtn');
if (retry) retry.addEventListener('click', async () => { await fetch('/api/kit/' + slug + '/retry', {method:'POST'}); location.reload(); });
async function loadDocs(){
  for (const d of ['brief','posts','outreach']) {
    const el = document.getElementById('doc-' + d);
    if (!el) continue;
    const res = await fetch('/kit/' + slug + '/doc/' + d);
    el.innerHTML = res.ok ? await res.text() : '<p class="err">Not generated yet.</p>';
  }
}
let finished = ${done};
if (finished) loadDocs();
async function poll(){
  if (finished) return;
  try {
    const res = await fetch('/api/kit/' + slug);
    const k = await res.json();
    for (const [name, st] of Object.entries(k.stages)) {
      const el = document.querySelector('[data-stage="' + name + '"]');
      if (!el) continue;
      el.className = 'stage ' + st;
      el.querySelector('.st-label').textContent = st;
    }
    const failed = Object.values(k.stages).includes('failed');
    if (k.stages.package === 'done' || failed) { location.reload(); return; }
  } catch {}
  setTimeout(poll, 1500);
}
poll();`;
  return shell(`${name} — CurbAppeal`, body, js);
}
