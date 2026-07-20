// HTTP server & routing. Zero framework — Bun.serve with a small matcher.
import { existsSync, readFileSync, statSync, realpathSync } from "node:fs";
import { join, normalize, sep } from "node:path";
import { PORT, resolveLlmMode, resolvePlacesMode } from "./config";
import { createKit, isRunning, kitDir, listKits, loadKit, retryKit, runKit, type KitInput } from "./pipeline";
import { listFixtures } from "./sources";
import { homePage, kitPage } from "./ui";
import { mdLite, SLUG_RE } from "./util";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".zip": "application/zip",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function html(markup: string): Response {
  return new Response(markup, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function badSlug(slug: string): boolean {
  return !SLUG_RE.test(slug);
}

// Serve a file from inside a kit directory, refusing anything that escapes it.
function serveKitFile(slug: string, rel: string): Response {
  if (badSlug(slug)) return json({ error: "bad slug" }, 400);
  const dir = kitDir(slug);
  const target = normalize(join(dir, rel));
  // Lexical containment (blocks ../ escape).
  if (!target.startsWith(dir + sep) && target !== dir) return json({ error: "forbidden" }, 403);
  const ext = target.slice(target.lastIndexOf("."));
  if (!MIME[ext]) return json({ error: "file type not served" }, 403);
  if (!existsSync(target) || !statSync(target).isFile()) return json({ error: "not found" }, 404);
  // Symlink containment: resolve to the real path and re-check it stays in the kit tree.
  let real: string;
  let realDir: string;
  try {
    real = realpathSync(target);
    realDir = realpathSync(dir);
  } catch {
    return json({ error: "not found" }, 404);
  }
  if (real !== realDir && !real.startsWith(realDir + sep)) return json({ error: "forbidden" }, 403);
  const headers: Record<string, string> = { "Content-Type": MIME[ext] };
  // Generated HTML renders in an iframe; other files (SVG especially) could run
  // script if navigated to directly. A no-script CSP on every kit file closes both.
  headers["Content-Security-Policy"] =
    ext === ".html"
      ? "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
      : "default-src 'none'; style-src 'unsafe-inline'";
  return new Response(Bun.file(target), { headers });
}

const server = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 120,
  maxRequestBodySize: 512 * 1024, // operator tool; kit requests are tiny
  error(err) {
    console.error("server error:", err);
    return json({ error: "internal error" }, 500);
  },
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    if (path === "/" && req.method === "GET") {
      const demoNames = listFixtures().map((p) => p.displayName?.text ?? "").filter(Boolean);
      return html(homePage(listKits().slice(0, 24), resolveLlmMode(), resolvePlacesMode(), demoNames));
    }

    if (path === "/api/health") {
      return json({ ok: true, llmMode: resolveLlmMode(), placesMode: resolvePlacesMode() });
    }

    if (path === "/api/kits" && req.method === "POST") {
      let body: Partial<KitInput>;
      try {
        body = (await req.json()) as Partial<KitInput>;
      } catch {
        return json({ error: "invalid JSON body" }, 400);
      }
      const query = String(body.query ?? "").trim();
      if (query.length < 3) return json({ error: "Enter a Maps link, place ID, or business name." }, 400);
      if (query.length > 500) return json({ error: "Query too long." }, 400);
      const tone = ["auto", "warm", "modern", "bold"].includes(String(body.tone)) ? (body.tone as KitInput["tone"]) : "auto";
      const language = ["auto", "en", "es"].includes(String(body.language)) ? (body.language as KitInput["language"]) : "auto";
      const state = createKit({ query, tone, goal: String(body.goal ?? ""), language, notes: String(body.notes ?? "") });
      runKit(state.slug);
      return json({ slug: state.slug });
    }

    if (path === "/api/kits" && req.method === "GET") {
      return json(listKits());
    }

    let m = path.match(/^\/api\/kit\/([^/]+)$/);
    if (m && req.method === "GET") {
      if (badSlug(m[1])) return json({ error: "bad slug" }, 400);
      const kit = loadKit(m[1]);
      return kit ? json({ ...kit, running: isRunning(m[1]) }) : json({ error: "not found" }, 404);
    }

    m = path.match(/^\/api\/kit\/([^/]+)\/retry$/);
    if (m && req.method === "POST") {
      if (badSlug(m[1])) return json({ error: "bad slug" }, 400);
      return retryKit(m[1]) ? json({ ok: true }) : json({ error: "cannot retry" }, 409);
    }

    m = path.match(/^\/kit\/([^/]+)$/);
    if (m && req.method === "GET") {
      if (badSlug(m[1])) return json({ error: "bad slug" }, 400);
      const kit = loadKit(m[1]);
      if (!kit) return html(`<p style="font-family:sans-serif;padding:40px">Kit not found. <a href="/">Home</a></p>`);
      return html(kitPage(kit));
    }

    // Markdown deliverables rendered for the in-app viewer.
    m = path.match(/^\/kit\/([^/]+)\/doc\/(brief|posts|outreach)$/);
    if (m && req.method === "GET") {
      if (badSlug(m[1])) return json({ error: "bad slug" }, 400);
      const file = join(kitDir(m[1]), `${m[2]}.md`);
      if (!existsSync(file)) return new Response("not generated yet", { status: 404 });
      return html(mdLite(readFileSync(file, "utf8")));
    }

    m = path.match(/^\/kit\/([^/]+)\/download$/);
    if (m && req.method === "GET") {
      if (badSlug(m[1])) return json({ error: "bad slug" }, 400);
      const zip = join(kitDir(m[1]), "kit.zip");
      if (!existsSync(zip)) return json({ error: "kit not packaged yet" }, 404);
      return new Response(Bun.file(zip), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${m[1]}-kit.zip"`,
        },
      });
    }

    m = path.match(/^\/kit\/([^/]+)\/file\/(.+)$/);
    if (m && req.method === "GET") {
      return serveKitFile(m[1], m[2]);
    }

    return json({ error: "not found" }, 404);
  },
});

console.log(`\n  CurbAppeal running → http://localhost:${server.port}`);
console.log(`  AI mode: ${resolveLlmMode()} · Places mode: ${resolvePlacesMode()}\n`);
