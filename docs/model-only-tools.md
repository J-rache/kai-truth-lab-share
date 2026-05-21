# Model-Only Tools

Some tools are better for model seats than for humans. They should be documented as model-oriented rather than forced into a human dashboard.

## Current Model-Oriented Tools

- MCP tool server: `npm run mcp`
- CLI eval runner: `node src/cli.mjs eval run <id> --json`
- CLI source status: `node src/cli.mjs source-status --json`
- HTTP model-seat attach: `POST /api/seats/attach`
- HTTP model-seat heartbeat: `POST /api/seats/heartbeat`
- HTTP eval runner: `POST /api/evals/:id/run`
- HTTP note writer: `POST /api/session-notes`

## Boundary

These tools do not create model identity. They create recorded client activity. A model is attached only when a client uses the protocol and leaves evidence.

