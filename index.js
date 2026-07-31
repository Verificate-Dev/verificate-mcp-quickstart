#!/usr/bin/env node
/**
 * Verificate MCP — stdio bridge
 *
 * A zero-dependency MCP server (stdio transport) that exposes the Verificate
 * validation tools locally and forwards tool calls to the hosted Verificate
 * gateway. Lets stdio-only MCP clients (and directory health checks) use the
 * hosted service.
 *
 *   VERIFICATE_TOKEN  – Bearer token from https://verificate.ai (dashboard).
 *                       Without it, initialize/tools/list still work; tool
 *                       calls return an instructive error.
 *   VERIFICATE_URL    – Override the gateway URL (default: production).
 */

"use strict";

const GATEWAY =
  process.env.VERIFICATE_URL ||
  "https://mcp.verificate.ai/mcp";
const TOKEN = process.env.VERIFICATE_TOKEN || "";
const VERSION = "1.8.0";
const PROTOCOL_VERSION = "2025-06-18";

const TOOLS = [
  {
    name: "validate_ai_output",
    description:
      "Enterprise validation gate (IBM/ISO/MLOps, top-5% bar). Approves code or plans, flags performance/scalability/reliability/tech-debt issues (not syntax), and enforces deterministic anti-placeholder/anti-deception gates. Set validation_type='plan' to validate a plan.",
    inputSchema: {
      type: "object",
      properties: {
        ai_output: { type: "string", description: "Code, plan, or output to validate" },
        context: { type: "object", description: 'Context, e.g. {"language": "cpp"}' },
        validation_type: {
          type: "string",
          default: "code_generation",
          description: "code_generation | plan | design | architecture | text",
        },
      },
      required: ["ai_output"],
    },
  },
  {
    name: "analyze_code",
    description:
      "Enterprise code analysis: performance/scalability hot paths, reliability, tech debt, and ISO/IEC 25010 + MLOps quality attributes (syntax/lint assumed handled upstream).",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "Code to analyze" },
        language: { type: "string", description: "Source language (python, cpp, sql, swift, ...)" },
        analysis_type: {
          type: "string",
          default: "quality",
          description: "quality | performance | scalability | security | tech_debt",
        },
      },
      required: ["code"],
    },
  },
  {
    name: "validate_plan",
    description:
      "Validate a PLAN/design BEFORE coding against enterprise standards: completeness, feasibility, performance & scalability implications, risks, ISO/MLOps compliance, and missing considerations.",
    inputSchema: {
      type: "object",
      properties: {
        plan: { type: "string", description: "The plan/design/spec to validate" },
        context: { type: "object", description: "Optional context (system, constraints, scale targets)" },
      },
      required: ["plan"],
    },
  },
  {
    name: "generate_code",
    description:
      "Generate code with an LLM, then gate the result through the protection engine (no placeholder output)",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Code generation prompt" },
        language: { type: "string", default: "python" },
        max_tokens: { type: "integer", default: 4000 },
      },
      required: ["prompt"],
    },
  },
];

/* ---------------- upstream (streamable HTTP) ---------------- */

let sessionId = null;
let upstreamId = 0; // the gateway requires integer JSON-RPC ids; client ids are re-mapped

async function upstreamPost(body, extraHeaders = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${TOKEN}`,
    ...extraHeaders,
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(GATEWAY, { method: "POST", headers, body: JSON.stringify(body) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessionId = sid;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`gateway HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/event-stream")) {
    // Parse SSE: take the last data: payload that parses as JSON-RPC.
    let last = null;
    for (const line of text.split(/\r?\n/)) {
      if (line.startsWith("data:")) {
        try {
          last = JSON.parse(line.slice(5).trim());
        } catch {
          /* keep scanning */
        }
      }
    }
    if (last === null) throw new Error("gateway returned an empty event stream");
    return last;
  }
  if (!text) return null; // e.g. 202 Accepted for notifications
  return JSON.parse(text);
}

async function ensureUpstreamSession() {
  if (sessionId) return;
  const init = await upstreamPost({
    jsonrpc: "2.0",
    id: ++upstreamId,
    method: "initialize",
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "verificate-mcp-bridge", version: VERSION },
    },
  });
  if (init && init.error) throw new Error(`gateway initialize failed: ${init.error.message}`);
  await upstreamPost({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => {});
}

async function forwardToolCall(id, params) {
  await ensureUpstreamSession();
  const res = await upstreamPost({ jsonrpc: "2.0", id: ++upstreamId, method: "tools/call", params });
  if (res && res.error) {
    return { jsonrpc: "2.0", id, error: res.error };
  }
  return { jsonrpc: "2.0", id, result: res.result };
}

/* ---------------- stdio JSON-RPC loop ---------------- */

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function toolError(id, message) {
  return {
    jsonrpc: "2.0",
    id,
    result: { content: [{ type: "text", text: message }], isError: true },
  };
}

async function handle(msg) {
  const { id, method, params } = msg;
  switch (method) {
    case "initialize":
      return send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "verificate-mcp", version: VERSION },
          instructions:
            "Validation gates for AI coding. Call validate_ai_output on substantive changes before presenting them as complete; a REJECTED verdict means fix the findings and re-validate. Requires VERIFICATE_TOKEN (30-day free trial: https://verificate.ai/auth/signup).",
        },
      });
    case "notifications/initialized":
    case "notifications/cancelled":
      return; // notifications get no response
    case "ping":
      return send({ jsonrpc: "2.0", id, result: {} });
    case "tools/list":
      return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    case "tools/call": {
      if (!TOKEN) {
        return send(
          toolError(
            id,
            "VERIFICATE_TOKEN is not set. Create an account at https://verificate.ai/auth/signup (30-day free trial, no card), copy the token from your dashboard, and set VERIFICATE_TOKEN in this server's environment."
          )
        );
      }
      try {
        return send(await forwardToolCall(id, params));
      } catch (err) {
        return send(toolError(id, `Verificate gateway error: ${err.message}`));
      }
    }
    default:
      if (id !== undefined && id !== null) {
        send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
      }
  }
}

let buffer = "";
let pending = 0;
let stdinClosed = false;

function maybeExit() {
  if (stdinClosed && pending === 0) process.exit(0);
}

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
      continue;
    }
    pending++;
    Promise.resolve(handle(msg))
      .catch((err) => {
        if (msg.id !== undefined && msg.id !== null) {
          send({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(err.message || err) } });
        }
      })
      .finally(() => {
        pending--;
        maybeExit();
      });
  }
});
// Drain in-flight requests before exiting when the client closes stdin.
process.stdin.on("end", () => {
  stdinClosed = true;
  maybeExit();
});
