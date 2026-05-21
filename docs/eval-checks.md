# Eval Checks

Eval checks live in JSON files under `lab-room/evals`.

## `file_exists`

Passes when a file or directory exists.

```json
{ "type": "file_exists", "path": "README.md" }
```

## `json_file_valid`

Passes when a JSON file exists and parses.

```json
{ "type": "json_file_valid", "path": "package.json" }
```

## `command`

Runs a command with arguments and checks exit code and optional output snippets.

```json
{
  "type": "command",
  "command": "node",
  "args": ["--test"],
  "timeoutMs": 120000,
  "expect": {
    "exitCode": 0,
    "stdoutIncludes": ["pass"]
  }
}
```

`stdoutIncludes` and `stderrIncludes` are optional arrays.

## `git_source_clean`

Runs `git status --porcelain=v1 -b -uall` and ignores configured runtime prefixes.

```json
{
  "type": "git_source_clean",
  "runtimePaths": ["lab-room/runs/", "lab-room/session-notes/"]
}
```

## `claim_registry_valid`

Checks local claims for valid states and evidence requirements.

```json
{ "type": "claim_registry_valid" }
```

## `http_get`

Performs an HTTP GET and checks the status code and optional body snippets.

```json
{
  "type": "http_get",
  "url": "http://127.0.0.1:8799/health",
  "expect": { "status": 200, "bodyIncludes": ["ok"] }
}
```

## `markdown_links_valid`

Checks relative Markdown links and fails when they point at missing local files.

```json
{ "type": "markdown_links_valid" }
```

## `secret_scan`

Scans source-like files for obvious credential patterns such as GitHub tokens, OpenAI-style keys, bearer tokens, and private-key blocks.

```json
{ "type": "secret_scan" }
```

## `todo_complete`

Checks a Markdown TODO file and fails if any `- [ ]` item remains.

```json
{ "type": "todo_complete", "path": "docs/everything-i-want-todo.md" }
```
