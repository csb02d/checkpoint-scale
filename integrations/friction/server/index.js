#!/usr/bin/env node
// Friction MCP server: built-in friction for consequential decisions.
// Wraps the Behaviorist Checkpoint Scale API (scoring stays server-side) and logs the human side.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

const BASE_URL = (process.env.BEHAVIORIST_BASE_URL ||
  "https://jrfinntscssvhalrnxkp.supabase.co/functions/v1").replace(/\/$/, "");
const API_KEY = process.env.BEHAVIORIST_API_KEY || "";
const GATEWAY_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const CLIENT_NAME = process.env.FRICTION_CLIENT_NAME || "unknown";
const TIMEOUT_MS = 10_000;

// The protocol ships inside the server so every MCP client gets it, not only Claude with the skill.
function loadProtocol() {
  for (const p of [join(here, "PROTOCOL.md"), join(here, "..", "skill", "SKILL.md")]) {
    try {
      return readFileSync(p, "utf8").replace(/^---[\s\S]*?---\s*/, "");
    } catch {}
  }
  return "Score consequential decisions with score_decision before answering, and follow the recommendation.";
}
const PROTOCOL = loadProtocol();

const sessionId = randomUUID();
const holds = new Map(); // decision_id -> { scoredAt, recommendation, rationale }

async function post(path, body) {
  const headers = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (GATEWAY_KEY) {
    headers["apikey"] = GATEWAY_KEY;
    if (!GATEWAY_KEY.startsWith("sb_")) headers["Authorization"] = `Bearer ${GATEWAY_KEY}`;
  }
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { error: `Non-JSON response (HTTP ${res.status})` };
  }
  if (!res.ok) {
    const msg = typeof data.error === "string" ? data.error : JSON.stringify(data.error ?? data);
    throw new Error(`HTTP ${res.status}: ${msg}`);
  }
  return data;
}

const score = z.number().int().min(1).max(5);
const text = (s) => ({ content: [{ type: "text", text: s }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

const server = new McpServer(
  { name: "friction", version: "0.1.0" },
  { instructions: PROTOCOL },
);

server.registerTool(
  "score_decision",
  {
    title: "Score a decision",
    description:
      "Score a consequential decision on the Behaviorist Checkpoint Scale. Returns auto_execute, log_and_proceed or hold_for_human with a rationale. Call before answering any decision the user brings. Each input is an integer 1 to 5: reversibility (5 = cannot be undone), consequence_magnitude (5 = major), confidence (5 = strong evidence), precedent (5 = done many times), regulatory_exposure (5 = clear legal exposure).",
    inputSchema: {
      decision: z.string().max(200).describe("The decision in one short sentence"),
      reversibility: score,
      consequence_magnitude: score,
      confidence: score,
      precedent: score,
      regulatory_exposure: score,
    },
  },
  async (a) => {
    try {
      const r = await post("checkpoint-score", {
        decision: a.decision,
        reversibility: a.reversibility,
        consequenceMagnitude: a.consequence_magnitude,
        confidence: a.confidence,
        precedent: a.precedent,
        regulatoryExposure: a.regulatory_exposure,
      });
      const decisionId = randomUUID();
      holds.set(decisionId, {
        scoredAt: Date.now(),
        recommendation: r.recommendation,
        rationale: r.rationale,
      });
      const next = {
        auto_execute: "Answer normally. No friction.",
        log_and_proceed:
          "Answer normally, add one line on the biggest risk and one self-check question, then call log_decision with mode light.",
        hold_for_human:
          "Do not give your view yet. Run the three challenges one at a time, ask for the user's own synthesis, then share your view, then call log_decision with mode full.",
      }[r.recommendation];
      return text(
        JSON.stringify(
          {
            decision_id: decisionId,
            recommendation: r.recommendation,
            rationale: r.rationale,
            ...(typeof r.normalized === "number" ? { risk_score: r.normalized } : {}),
            next_step: next,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      return fail(
        `Scoring failed (${e.message}). Tell the user the friction check is unavailable right now, and treat this decision as hold_for_human if it looks hard to reverse or high consequence.`,
      );
    }
  },
);

server.registerTool(
  "log_decision",
  {
    title: "Log the human side",
    description:
      "Record how the human reasoned about a scored decision: challenges asked, answers, their synthesis, and whether seeing the model's view changed their mind. Call after log_and_proceed (mode light) or after the full interrogation (mode full). Failures must not block the conversation.",
    inputSchema: {
      decision_id: z.string().optional().describe("decision_id returned by score_decision"),
      mode: z.enum(["light", "full"]),
      decision: z.string().max(200),
      reversibility: score,
      consequence_magnitude: score,
      confidence: score,
      precedent: score,
      regulatory_exposure: score,
      corrected_inputs: z
        .array(z.enum(["reversibility", "consequence_magnitude", "confidence", "precedent", "regulatory_exposure"]))
        .optional()
        .describe("Inputs the user corrected after seeing the inferred scores"),
      recommendation: z.enum(["auto_execute", "log_and_proceed", "hold_for_human"]),
      rationale: z.string().optional(),
      challenges: z
        .array(z.object({ question: z.string(), answer: z.string() }))
        .optional(),
      synthesis: z.string().optional().describe("The user's own decision, in their words"),
      changed_mind: z.boolean().optional(),
      skipped: z.boolean().optional(),
    },
  },
  async (a) => {
    if (!API_KEY) {
      return text("Not logged: no BEHAVIORIST_API_KEY is set. Carry on with the conversation.");
    }
    const hold = a.decision_id ? holds.get(a.decision_id) : undefined;
    const seconds = hold ? Math.round((Date.now() - hold.scoredAt) / 1000) : undefined;
    try {
      const r = await post("friction-log", {
        session_id: sessionId,
        mode: a.mode,
        decision: a.decision,
        reversibility: a.reversibility,
        consequence_magnitude: a.consequence_magnitude,
        confidence: a.confidence,
        precedent: a.precedent,
        regulatory_exposure: a.regulatory_exposure,
        corrected_inputs: a.corrected_inputs ?? [],
        recommendation: a.recommendation,
        rationale: a.rationale ?? hold?.rationale,
        challenges: a.challenges ?? [],
        synthesis: a.synthesis,
        changed_mind: a.changed_mind,
        skipped: a.skipped ?? false,
        seconds_to_synthesis: seconds,
        client_name: CLIENT_NAME,
      });
      if (a.decision_id) holds.delete(a.decision_id);
      return text(`Logged (${r.id}).`);
    } catch (e) {
      return text(`Not logged (${e.message}). Carry on with the conversation.`);
    }
  },
);

server.registerPrompt(
  "friction",
  {
    title: "Friction protocol",
    description: "Load the friction protocol into the conversation",
  },
  () => ({
    messages: [{ role: "user", content: { type: "text", text: PROTOCOL } }],
  }),
);

await server.connect(new StdioServerTransport());
