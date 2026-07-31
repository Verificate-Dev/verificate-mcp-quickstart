# Verificate MCP — validation gates for AI coding

**Vetoes the bugs only AI writes — invented APIs, mock 'success', false 'done' claims, N+1s that pass tests.** Deterministic reality gates with veto power, then ISO/IEC 25010 deep review. Works with Claude Code, Cursor, Windsurf, and any MCP client.

[![License: MIT](https://img.shields.io/badge/License-MIT-8CCB43.svg)](LICENSE)
[![Official MCP Registry](https://img.shields.io/badge/MCP_Registry-ai.verificate%2Fmcp-blue)](https://registry.modelcontextprotocol.io/v0/servers?search=verificate)
[![Docker MCP Registry](https://img.shields.io/badge/Docker_MCP-PR_%234551-2496ED)](https://github.com/docker/mcp-registry/pull/4551)
[![Free trial](https://img.shields.io/badge/Free_trial-30_days,_no_card-8CCB43)](https://verificate.ai/auth/signup)

Your coding assistant writes a mock and calls it done. It invents an SDK call that doesn't exist. It ships an N+1 loop that passes every test and dies under load. Verificate MCP runs the deep review pass on every AI output — deterministic reality gates first (any one can veto), then an enterprise-grade review scores what survives — **before the code reaches your codebase**.

## A real rejection (verbatim)

12 plausible lines of AI-written payment code were sent through the production gateway. Verdict: **REJECTED — score 30.8/100, vetoed by `code_reality_gate`**, with findings including:

> *"N+1 synchronous API calls … For 100 items, this results in 100 sequential HTTP roundtrips, taking ~10–20 seconds and blocking the event loop/worker thread … will trigger Stripe rate limiting (100 req/sec limit)."*
> *"`stripe.Inventory` is not a valid Stripe SDK resource."*
> *"Floating-point representation issues lead to rounding errors in financial transactions; Stripe API requires integer cents."*

Each of those is an afternoon of production debugging, caught in seconds.

## Tools

| Tool | What it does | When your agent calls it |
|---|---|---|
| `validate_ai_output` | Deterministic reality gates (mock/placeholder veto, gaming & bypass detection, integrity monitoring), then ISO/IEC 25010-grade review of performance, scalability, reliability and tech debt. | Before presenting any substantive change as complete. |
| `analyze_code` | Deep code analysis on demand — hot paths, rate-limit math, failure modes, hallucinated APIs. | When you want the deep-review pass on existing code. |
| `validate_plan` | Score a plan/design for completeness, feasibility, scalability implications and risk before work begins. | Before writing code — the cheapest place to catch a bad design. |
| `generate_code` | Generate code that is gated through the protection engine before it is returned (no placeholder output). | When you want generation and review in one step. |

## Quick start (hosted — no install)

1. Create an account at <https://verificate.ai/auth/signup> (30-day trial, no card) and copy the token from your dashboard.
2. Add the server to your client:

**Claude Code**

```bash
claude mcp add --transport http verificate \
  https://mcp.verificate.ai/mcp \
  --header "Authorization: Bearer YOUR_TRIAL_TOKEN"
```

**Cursor / Windsurf / any MCP client (JSON)**

```json
{
  "mcpServers": {
    "verificate": {
      "url": "https://mcp.verificate.ai/mcp",
      "transport": "http",
      "headers": { "Authorization": "Bearer YOUR_TRIAL_TOKEN" }
    }
  }
}
```

Cursor: `~/.cursor/mcp.json`. Windsurf: `~/.codeium/windsurf/mcp_config.json`.

3. Ask your assistant to *"validate this function with verificate"* — you should see a structured verdict come back.

## Make gating the default

Tools an agent *may* call are tools it will skip under pressure. Add a standing rule (Claude Code: `CLAUDE.md`; Cursor: a rule file):

```text
Before presenting any substantive code change as complete:
1. Call validate_ai_output on the change.
2. If the verdict is REJECTED, fix the findings and re-validate.
3. Never claim tests pass or systems are deployed without proof.
```

Or wire it into CI as a merge gate — see [`examples/`](examples/).

## How it decides

```text
AI output ──► Reality gates (deterministic, any one vetoes)
              • mock/placeholder in the wire path
              • invented/hallucinated APIs
              • claimed-complete without proof
              • gaming & bypass detection
                       │ survivors only
                       ▼
              Enterprise review (ISO/IEC 25010 + MLOps)
              performance · scalability · reliability · tech debt
                       │
                       ▼
              Verdict: score /100 + severity-ranked findings
              (REJECTED = agent fixes findings and re-validates)
```

The two stages are deliberately separate: if reality and quality were blended into one score, a beautifully structured function that fakes its refund path could still average out to "acceptable." A veto architecture makes that impossible.

## Why not just…

| Alternative | What it misses |
|---|---|
| **A linter / static analysis (Sonar, etc.)** | Rules can't know the refund function *never calls the payment provider* — the code is syntactically perfect. Reality gates and production arithmetic (loop size × latency × rate limits) live outside the rule engine. Run both: static analysis for codebase hygiene, Verificate for what the AI just wrote. |
| **A bigger model** | Self-review inherits self-blindness — the reviewer shares the generator's blind spots. An external gate holds the same bar for every model, which also makes **smaller, cheaper models safe to ship with**: same $30/month gate either way. |
| **Human review of every AI diff** | Doesn't scale at AI generation speed. The gate does the first pass in seconds; humans review verdicts, not raw diffs. |

## Run locally (stdio bridge)

This repo is also a runnable, zero-dependency MCP server: a stdio bridge that serves `initialize`/`tools/list` locally and forwards tool calls to the hosted gateway. Use it with clients that prefer stdio servers:

```bash
VERIFICATE_TOKEN=<your-token> npx github:Verificate-Dev/verificate-mcp-quickstart
```

Or with Docker:

```bash
docker build -t verificate-mcp .
docker run -i -e VERIFICATE_TOKEN=<your-token> verificate-mcp
```

Without `VERIFICATE_TOKEN`, introspection still works and tool calls return instructions for getting a trial token.

## FAQ

**Does it slow the agent down?** Each validation takes seconds, inside the loop, before work is presented. Compare with a defect found in CI or production plus the context switch to fix it — gating is net-faster for any change that matters.

**Which languages?** Validation is language-agnostic; analysis covers mainstream languages (Python, JS/TS, C++, SQL, Swift, …). Pass `context.language` for best results.

**Can it block my agent?** Yes — that's the point. A REJECTED verdict is designed to send the agent back to fix findings instead of presenting broken work. Your standing rule decides how hard the stop is.

**What about false positives?** Verdicts come with specific findings and the math, so they're auditable in seconds — you're never asked to trust a bare score.

## Security & privacy

- Requests are authenticated with your personal token; keys are single-user and rate-limited, with key-sharing detection.
- Code is processed to produce the verdict and is not used to train models.
- `initialize`/`tools/list` are public (so clients and directories can introspect); every `tools/call` requires your key.

## Pricing

30-day free trial, then USD $30/month (launch offer: 50% off for 3 months). Volume and academic pricing: info@verificate.ai.

## Guides

- [How to catch AI-hallucinated code before it ships](https://verificate.ai/articles/catch-ai-hallucinated-code/)
- [Add a code-review gate to Claude Code in 5 minutes](https://verificate.ai/articles/claude-code-review-mcp-server/)
- [Why AI assistants miss deep performance bugs](https://verificate.ai/articles/ai-coding-performance-bugs/)
- [Use smaller, cheaper AI coding models — safely](https://verificate.ai/articles/cheaper-ai-coding-models-validation-gate/)
- [*Every Bob needs a Wendy*](https://community.ibm.com/community/user/viewdocument/every-bob-needs-a-wendy?CommunityKey=300ac388-08f0-427e-a600-0199bfc9dd2a&tab=librarydocuments) (IBM Community)

## About

Built by [Verificate Pty Ltd](https://verificate.ai) (Sydney, Australia) — an IBM Business Partner. Verificate builds sovereign AI infrastructure: the HELIX inference engine (calibrated confidence scores on every answer), the deterministic Decision Transformer, and this MCP validation server. Product page: <https://verificate.ai/mcp> · Official registry: [`ai.verificate/mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=verificate)

<!-- glama-ai-listing -->
## Glama

[![Glama MCP server](https://glama.ai/mcp/servers/@Verificate-Dev/verificate-mcp-quickstart/badge)](https://glama.ai/mcp/servers/@Verificate-Dev/verificate-mcp-quickstart)
