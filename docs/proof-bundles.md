# Proof Bundles

Proof bundles turn a completion claim into a durable artifact.

They record:

- current git status
- current commit
- remote head lookup for the current branch
- selected verification command results
- JSON and Markdown files under `lab-room/proof-bundles/`

Create a full bundle:

```powershell
node src/cli.mjs proof bundle --label final-handoff --json
```

Create a quick source-only bundle:

```powershell
node src/cli.mjs proof bundle --label quick-check --quick --json
```

List recent bundles:

```powershell
node src/cli.mjs proof list --json
```

Proof bundles are runtime artifacts. They are ignored by git unless deliberately exported or copied into a handoff.
