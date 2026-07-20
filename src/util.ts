// Shared helpers: escaping, slugs, tolerant JSON extraction, shape validation, tiny markdown.

export function esc(s: unknown): string {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "kit";
  const suffix = Math.random().toString(16).slice(2, 6);
  return `${base}-${suffix}`;
}

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;

// LLMs occasionally wrap JSON in prose or fences; pull out the first balanced object.
export function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {}
  }
  const start = trimmed.indexOf("{");
  if (start === -1) throw new Error("no JSON object found in model output");
  let depth = 0;
  let inStr = false;
  let escNext = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escNext) { escNext = false; continue; }
    if (ch === "\\") { escNext = true; continue; }
    if (ch === '"') inStr = !inStr;
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return JSON.parse(trimmed.slice(start, i + 1));
    }
  }
  throw new Error("unbalanced JSON in model output");
}

// Minimal structural validation: shape = {key: "string" | "number" | "array" | "object"}.
// Keys suffixed with "?" are optional.
export function expectShape(obj: unknown, shape: Record<string, string>, label: string): Record<string, unknown> {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new Error(`${label}: expected an object`);
  }
  const rec = obj as Record<string, unknown>;
  for (const [rawKey, type] of Object.entries(shape)) {
    const optional = rawKey.endsWith("?");
    const key = optional ? rawKey.slice(0, -1) : rawKey;
    const val = rec[key];
    if (val === undefined || val === null) {
      if (optional) continue;
      throw new Error(`${label}: missing required field "${key}"`);
    }
    const ok =
      type === "array" ? Array.isArray(val) :
      type === "object" ? typeof val === "object" && !Array.isArray(val) :
      typeof val === type;
    if (!ok) throw new Error(`${label}: field "${key}" should be ${type}`);
  }
  return rec;
}

// Tiny markdown renderer for LLM text we display in-app (not in generated sites).
// Supports headings, bold, lists, paragraphs. Everything is escaped first.
export function mdLite(md: string): string {
  const lines = String(md ?? "").split("\n");
  const out: string[] = [];
  let inList = false;
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  for (const raw of lines) {
    const line = esc(raw).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); out.push(`<h${h[1].length + 1}>${h[2]}</h${h[1].length + 1}>`); continue; }
    const li = line.match(/^\s*[-*]\s+(.*)$/);
    if (li) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${li[1]}</li>`); continue; }
    closeList();
    if (line.trim() === "") continue;
    out.push(`<p>${line}</p>`);
  }
  closeList();
  return out.join("\n");
}

export function hexColor(input: unknown, fallback: string): string {
  const s = String(input ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s : fallback;
}

export function clampStr(s: unknown, max: number): string {
  return String(s ?? "").slice(0, max);
}

export function todayLong(locale = "en-US"): string {
  return new Date().toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}
