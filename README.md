# Codex Truth Lab Community

This is the public share build exported from the private internal workbench.

Codex Truth Lab is a local-first evaluation-gated AI workbench. It gives Codex, Kai, Mystro, local models, or other model seats a shared place to separate imagination from proof.

The lab is not a model and does not pretend to run one. It is a bench: checks, claims, tools, session notes, and ledgers that survive beyond one chat or IDE session.

## What It Does

- Runs repeatable eval gates from `lab-room/evals`.
- Stores run evidence in local JSONL ledgers.
- Tracks claims through explicit truth states.
- Refuses to promote stronger claim states without evidence.
- Tracks reusable tools with start, verification, permission, and limit notes.
- Exposes a small HTTP API so a model seat can attach as a client.
- Exposes a local dashboard at `http://127.0.0.1:8799`.
- Exposes a minimal MCP server for model-facing tool use.
- Exports a selected public share build while keeping internal runtime evidence private.
- Keeps runtime evidence separate from committed source.
- Runs an autonomy cycle that records failures instead of relying on a human to notice them.
- Creates Mystro completion handoffs and tool-promotion decisions.
- Creates proof bundles for final handbacks.
- Tracks GitHub/GitLab mirror plans without putting credentials in remote URLs.
- Records next-work decisions when autonomy needs to choose a direction.

Truth states:

1. `hypothesis`
2. `design_sketch`
3. `unverified`
4. `machine_proven`
5. `source_backed`
6. `production_ready`

## Quick Start

```powershell
npm install
npm run verify
npm start
```

CLI:

```powershell
node src/cli.mjs status
node src/cli.mjs source-status
node src/cli.mjs eval list
node src/cli.mjs eval run lab-self-check
node src/cli.mjs autonomy run
node src/cli.mjs next decide
node src/cli.mjs proof bundle --label final-handoff
node src/cli.mjs mirror plan --id gitlab-share --url https://gitlab.com/group/project.git
node src/cli.mjs failures list
node src/cli.mjs claim add --title "New idea" --body "Speculative until checked" --state hypothesis
node src/cli.mjs tool add --id sample --name "Sample Tool" --path "." --verify "npm run verify"
node src/cli.mjs note add --summary "Session close" --details "What changed and what was proven."
```

Server:

```powershell
$env:TRUTH_LAB_PORT=8799
npm start
```

Health:

```powershell
Invoke-RestMethod http://127.0.0.1:8799/health
```

MCP:

```powershell
npm run mcp
```

Public export:

```powershell
npm run export:public
```

Scheduled autonomy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-autonomy-task.ps1
```

## Lab Room Layout

```text
lab-room/
  lab-config.json          committed lab configuration
  evals/                   committed eval definitions
  claims/claims.json       ignored runtime registry
  tools/tools.json         ignored runtime registry
  runs/runs.jsonl          ignored runtime evidence
  session-notes/           ignored local handoff notes
  proof-bundles/           ignored proof artifacts
  redundancy/              ignored mirror plans and verification events
  next-work/               ignored self-directed decision ledger
```

## Gate Format

Eval files are JSON:

```json
{
  "id": "example",
  "name": "Example Gate",
  "description": "Short reason for the gate.",
  "checks": [
    { "type": "file_exists", "path": "package.json" },
    { "type": "json_file_valid", "path": "package.json" },
    {
      "type": "command",
      "command": "node",
      "args": ["--test"],
      "timeoutMs": 120000,
      "expect": { "exitCode": 0 }
    }
  ]
}
```

Supported checks are documented in [docs/eval-checks.md](docs/eval-checks.md). Autonomy details are documented in [docs/autonomy.md](docs/autonomy.md). Proof bundles are documented in [docs/proof-bundles.md](docs/proof-bundles.md). Repository redundancy is documented in [docs/redundancy.md](docs/redundancy.md).

## Finished Scope

The completed v1 checklist lives in [docs/everything-i-want-todo.md](docs/everything-i-want-todo.md). Final sparks and future non-claims live in [docs/sparks.md](docs/sparks.md).

## Boundary

This lab welcomes imagination, but it labels imagination. A hypothesis can be bold. A production-ready claim must have evidence.
