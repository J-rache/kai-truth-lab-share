# Autonomy Layer

The lab now has an autonomy loop, not only manual gates.

## Run Once

```powershell
node src/cli.mjs autonomy run --json
```

The cycle runs:

- `npm run verify`
- `completion-gate`
- `public-share-gate`
- `model-seat-gate`
- `source-status --fail-on-source`

It writes runtime evidence to `lab-room/autonomy` and writes failures to `lab-room/failure-inbox`.

## Install Schedule

```powershell
powershell -ExecutionPolicy Bypass -File scripts/install-autonomy-task.ps1
```

The scheduled task is named `CodexTruthLabAutonomy` and runs every six hours.

## Failure Inbox

```powershell
node src/cli.mjs failures list
node src/cli.mjs failures add --summary "Something broke" --source "manual"
```

## Mystro Handoff

```powershell
node src/cli.mjs mystro handoff --project mystro-table --mystro-url http://127.0.0.1:8787
```

Mystro should treat a failed handoff as a block on final completion.

