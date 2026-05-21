# Standalone App

The lab can run as a standalone local web app.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start-truth-lab.ps1
```

Default URL:

`http://127.0.0.1:8799`

The dashboard is intentionally quiet and operational. It is not a marketing page. It exposes:

- lab status
- eval gates
- recent run results
- truth-state claims
- tool registry
- attached model seats
- session notes

The server binds to `127.0.0.1` by default so the app is local-first.

