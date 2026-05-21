# First Run Example

```powershell
git clone https://github.com/J-rache/codex-truth-lab-share.git
cd codex-truth-lab-share
npm run verify
powershell -ExecutionPolicy Bypass -File scripts/start-truth-lab.ps1
```

Open:

`http://127.0.0.1:8799`

Run a gate:

```powershell
node src/cli.mjs eval run lab-self-check
```

Run an autonomy cycle:

```powershell
node src/cli.mjs autonomy run
```

