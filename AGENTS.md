# Codex Truth Lab Instructions

This repo is a local-first evaluation-gated AI workbench.

Completion doctrine:

- Do not call a claim real until it is backed by source, machine checks, or explicit evidence.
- Keep hypotheses, design sketches, unverified claims, machine-proven claims, source-backed claims, and production-ready claims separate.
- Prefer small, repeatable checks over one-time manual confidence.
- Runtime ledgers under `lab-room/runs` and `lab-room/session-notes` are local evidence, not source code.
- Do not commit secrets, tokens, Authorization headers, `.env` files, or credential-bearing runtime output.
- When changing code, run `npm test` and `npm run smoke` before handing back.

