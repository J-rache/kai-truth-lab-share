# Model Seat Protocol

The lab supports model seats through ordinary CLI/API actions. This keeps authority tied to evidence, not claims.

## Attach

`POST /api/seats/attach`

```json
{
  "clientId": "kai-codex",
  "label": "Kai / Codex",
  "model": "gpt-5.4-codex",
  "purpose": "Run eval-gated workbench checks"
}
```

The server records attached clients in local runtime state.

## Heartbeat

`POST /api/seats/heartbeat`

```json
{
  "clientId": "kai-codex",
  "focus": "Running repo truth checks"
}
```

## Run Gate

`POST /api/evals/lab-self-check/run`

The response includes pass/fail status and the persisted run id.

## Write Note

`POST /api/session-notes`

Use notes for handoff truth: what changed, what was proven, what remains.

## Boundary

An attached seat is not a mind or identity proof. It is a tool client with a recorded label, heartbeat, and activity trail.

