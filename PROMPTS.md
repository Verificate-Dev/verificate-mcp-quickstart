# One-paste setup prompts

Paste one of these into your assistant once per project. The agent verifies the
connection, installs hard gating rules, and proves the loop with a live
rejection → fix → approval pass.

## Claude Code

```text
Set up Verificate as this project's mandatory code gate:

1. Confirm the "verificate" MCP server is connected by calling its tools/list.
   If it isn't, stop and tell me exactly what to add to my MCP config.

2. Create or append to CLAUDE.md a section titled "## Verificate gate (hard rules)"
   with exactly these rules:
   - Every substantive code change MUST be passed through validate_ai_output
     (the complete change, not a fragment) before it is presented as done.
   - A REJECTED verdict is a stop: fix every finding, re-validate, and repeat
     until approved. Never present rejected code as complete, never summarise
     away findings, and never soften or reinterpret the verdict.
   - Before implementing any new feature or refactor, the implementation plan
     MUST pass validate_plan first, with real context (system, scale, constraints).
   - Claims like "tests pass", "integrated", or "deployed" require proof
     (command output), not assertion.
   - These rules override speed. If the gate is unreachable, say so and stop —
     do not skip validation silently.

3. Prove the loop works: write a deliberately flawed 10-line function (an N+1
   against a mock API), run it through validate_ai_output, show me the REJECTED
   verdict, fix it, re-validate to approval, and delete the demo file.

4. Confirm the rules file is saved and summarise what will now happen on every
   future change in this project.
```

## Cursor

```text
Set up Verificate as this project's mandatory code gate:

1. Verify the "verificate" MCP server is available (list its tools). If not,
   stop and tell me what to fix in ~/.cursor/mcp.json.

2. Create .cursor/rules/verificate-gate.mdc with alwaysApply: true containing:
   - Every substantive code change must pass validate_ai_output before being
     presented as complete — the whole change, not a fragment.
   - REJECTED means stop: fix every finding and re-validate until approved.
     Never ship, summarise past, or reinterpret a rejection.
   - Plans come first: any new feature or refactor requires validate_plan
     approval before code is written, with real context (system, scale).
   - No "done", "tests pass" or "integrated" claims without shown proof.
   - If the gate is unreachable, halt and report — never skip it silently.

3. Prove it: generate a small function with a deliberate flaw, show me the
   REJECTED verdict from validate_ai_output, fix it to approval, then clean up.

4. Confirm the rule file exists and is set to always apply.
```

Why these work: the agent verifies the connection first (a dead config is the
No. 1 reason gates go unused), the rules close the three evasion doors agents
actually use (shipping rejected work, summarising findings away, skipping a
flaky gate), and the live rejection in step 3 shows the gate catching something
in your first minute.
