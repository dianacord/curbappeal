// Tri-mode LLM client.
//   api  — Anthropic Messages API with structured outputs (guaranteed-valid JSON)
//   cli  — headless `claude -p` (works with a Claude Code login, no API key needed)
//   mock — handled upstream in the pipeline; llm.ts is never called in mock mode
import Anthropic from "@anthropic-ai/sdk";
import { config, resolveLlmMode, type LlmMode } from "./config";
import { extractJson } from "./util";

export interface LlmRequest {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}

let client: Anthropic | null = null;
function api(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

async function generateApi(req: LlmRequest): Promise<unknown> {
  const response = await api().messages.create({
    model: config.model,
    max_tokens: req.maxTokens ?? 8000,
    system: req.system,
    thinking: { type: "adaptive" },
    output_config: { format: { type: "json_schema", schema: req.schema } },
    messages: [{ role: "user", content: req.user }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("model declined this request (refusal)");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("model output truncated (max_tokens) — retry");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("no text block in model response");
  return JSON.parse(text.text);
}

async function generateCli(req: LlmRequest): Promise<unknown> {
  // Structured outputs aren't available through the CLI, so the schema is stated
  // in-prompt and the reply is parsed tolerantly.
  const prompt = [
    req.system,
    "",
    req.user,
    "",
    "Respond with a single JSON object and nothing else — no prose, no markdown fences.",
    "It must match this JSON Schema:",
    JSON.stringify(req.schema),
  ].join("\n");

  const proc = Bun.spawn(
    ["claude", "-p", "--model", config.cliModel, "--output-format", "json"],
    { stdin: new TextEncoder().encode(prompt), stdout: "pipe", stderr: "pipe" },
  );
  const killer = setTimeout(() => proc.kill(), 240_000);
  const [out, errText, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  clearTimeout(killer);
  if (code !== 0) {
    throw new Error(`claude CLI exited ${code}: ${errText.slice(0, 400) || out.slice(0, 400)}`);
  }
  let resultText = out;
  try {
    const envelope = JSON.parse(out);
    if (envelope && typeof envelope.result === "string") resultText = envelope.result;
  } catch {}
  return extractJson(resultText);
}

export async function generateJson(req: LlmRequest, mode: LlmMode = resolveLlmMode()): Promise<unknown> {
  const run = mode === "api" ? generateApi : generateCli;
  if (mode === "mock") throw new Error("generateJson called in mock mode — pipeline should use mock content");
  try {
    return await run(req);
  } catch (first) {
    // One retry; CLI mode occasionally wraps JSON in prose, API mode may hit a blip.
    try {
      return await run(req);
    } catch {
      throw first;
    }
  }
}
