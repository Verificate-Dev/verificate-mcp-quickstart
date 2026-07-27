# Verificate MCP — validation gates for AI coding

**Deterministic quality gates for AI-generated code, as an MCP server.** Works with Claude Code, Cursor, Windsurf, and any MCP client.

Your coding assistant writes a mock and calls it done. It invents an SDK call that doesn't exist. It ships an N+1 loop that passes every test and dies under load. Verificate MCP runs the deep review pass on every AI output — deterministic reality gates first (any one can veto), then an enterprise-grade review scores what survives — **before the code reaches your codebase**.

- 📇 Official MCP Registry: [`ai.verificate/mcp`](https://registry.modelcontextprotocol.io/v0/servers?search=verificate)
- 🌐 Product page: <https://verificate.ai/mcp>
- 📚 Guides: [catch hallucinated code](https://verificate.ai/articles/catch-ai-hallucinated-code/) · [5-minute setup](https://verificate.ai/articles/claude-code-review-mcp-server/) · [deep performance bugs](https://verificate.ai/articles/ai-coding-performance-bugs/) · [cheaper models, safely](https://verificate.ai/articles/cheaper-ai-coding-models-validation-gate/)
- 🆓 30-day free trial (no card): <https://verificate.ai/auth/signup>
- 📖 Background reading: [*Every Bob needs a Wendy*](https://community.ibm.com/community/user/viewdocument/every-bob-needs-a-wendy?CommunityKey=300ac388-08f0-427e-a600-0199bfc9dd2a&tab=librarydocuments) (IBM Community)

## Tools

| Tool | What it does |
|---|---|
| `validate_ai_output` | Gate any model output: deterministic reality gates (mock/placeholder veto, gaming & bypass detection, integrity monitoring), then ISO/IEC 25010-grade review of performance, scalability, reliability and tech debt. |
| `analyze_code` | Deep code analysis on demand — hot paths, rate-limit math, failure modes, hallucinated APIs. |
| `validate_plan` | Score an AI plan for feasibility and grounding before work begins. |
| `generate_code` | Generate code that is checked against your constraints before it is returned. |

## A real rejection (verbatim)

12 plausible lines of AI-written payment code were sent through the production gateway. Verdict: **REJECTED — score 30.8/100, vetoed by `code_reality_gate`**, with findings including:

> *"N+1 synchronous API calls … For 100 items, this results in 100 sequential HTTP roundtrips, taking ~10–20 seconds and blocking the event loop/worker thread … will trigger Stripe rate limiting (100 req/sec limit)."*
> *"`stripe.Inventory` is not a valid Stripe SDK resource."*
> *"Floating-point representation issues lead to rounding errors in financial transactions; Stripe API requires integer cents."*

Each of those is an afternoon of production debugging, caught in seconds.

## Setup

Create an account at <https://verificate.ai/auth/signup> and copy the trial token from your dashboard, then:

### Claude Code

```bash
claude mcp add --transport http verificate \
  https://verificate-portal-verificate-granite-4-small.apps.gpu4.fusion.isys.hpc.dc.uq.edu.au/mcp \
  --header "Authorization: Bearer YOUR_TRIAL_TOKEN"
```

### Cursor / Windsurf / any MCP client (JSON)

```json
{
  "mcpServers": {
    "verificate": {
      "url": "https://verificate-portal-verificate-granite-4-small.apps.gpu4.fusion.isys.hpc.dc.uq.edu.au/mcp",
      "transport": "http",
      "headers": { "Authorization": "Bearer YOUR_TRIAL_TOKEN" }
    }
  }
}
```

Cursor: add to `~/.cursor/mcp.json`. Windsurf: add to `~/.codeium/windsurf/mcp_config.json`.

## Suggested workflow

Ask your agent to validate before it finishes:

> "Before you consider this task done, run the diff through `validate_ai_output` and fix anything it vetoes."

Or wire it into CI as a merge gate — see [`examples/`](examples/).

## Pricing

30-day free trial, then USD $30/month (launch offer: 50% off for 3 months). Volume and academic pricing: info@verificate.ai.

## About

Built by [Verificate Pty Ltd](https://verificate.ai) (Sydney, Australia) — an IBM Business Partner. Verificate builds sovereign AI infrastructure: the HELIX inference engine (calibrated confidence scores on every answer), the deterministic Decision Transformer, and this MCP validation server. This repository contains client configuration and examples only.

<!-- glama-ai-listing -->
## Glama

[![Glama MCP server](https://glama.ai/mcp/servers/@Verificate-Dev/verificate-mcp-quickstart/badge)](https://glama.ai/mcp/servers/@Verificate-Dev/verificate-mcp-quickstart)
