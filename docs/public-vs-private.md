# Public vs Private Split

The internal repo is private because it can accumulate machine-specific tools, local runtime paths, operator notes, model-seat experiments, and future private adapters.

The public share repo is produced by `npm run export:public`. It includes the reusable lab code, docs, tests, starter gates, dashboard, launcher script, and public README. It excludes local runtime evidence, ignored registries, session notes, private cloud credentials, and machine-specific run output.

## Private Internal Repo

Use for:

- local model-seat experiments
- operator notes
- future private adapters
- local toolbox and cloud continuity work
- any machine-specific paths or evidence

## Public Share Repo

Use for:

- the standalone lab app
- CLI and HTTP API
- public docs and starter gates
- community-safe verification and truth-state patterns

## Rule

If a file contains private continuity, credentials, tokens, local personal notes, or machine-specific model experiments, it stays private. If a file helps other people build truth-gated workflows without exposing local state, it can go public.

