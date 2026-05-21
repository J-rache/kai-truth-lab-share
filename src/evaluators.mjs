import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { appendJsonl, labPaths, loadConfig, makeId, normalizeRepoPath, nowIso, readJson, resolveInside } from "./store.mjs";
import { loadEvaluation, validateClaimRegistry } from "./lab.mjs";

const execFileAsync = promisify(execFile);

export async function runEvaluation(id, { cwd = process.cwd() } = {}) {
  const evaluation = await loadEvaluation(id, { cwd });
  const startedAt = nowIso();
  const checkResults = [];
  for (const check of evaluation.checks) {
    checkResults.push(await runCheck(check, { cwd }));
  }
  const passed = checkResults.every((check) => check.ok);
  const run = {
    id: makeId("run"),
    evaluationId: evaluation.id ?? id,
    evaluationName: evaluation.name ?? id,
    status: passed ? "passed" : "failed",
    startedAt,
    finishedAt: nowIso(),
    checks: checkResults
  };
  await appendJsonl(labPaths(cwd).runs, run);
  return run;
}

export async function runCheck(check, { cwd = process.cwd() } = {}) {
  const startedAt = nowIso();
  try {
    switch (check.type) {
      case "file_exists":
        return finish(check, startedAt, fileExists(check, cwd));
      case "json_file_valid":
        return finish(check, startedAt, await jsonFileValid(check, cwd));
      case "command":
        return finish(check, startedAt, await commandCheck(check, cwd));
      case "git_source_clean":
        return finish(check, startedAt, await gitSourceClean(check, cwd));
      case "claim_registry_valid":
        return finish(check, startedAt, await claimRegistryValid(cwd));
      case "http_get":
        return finish(check, startedAt, await httpGet(check));
      case "markdown_links_valid":
        return finish(check, startedAt, await markdownLinksValid(check, cwd));
      case "secret_scan":
        return finish(check, startedAt, await secretScan(check, cwd));
      case "todo_complete":
        return finish(check, startedAt, await todoComplete(check, cwd));
      default:
        return finish(check, startedAt, { ok: false, message: `Unknown check type: ${check.type}` });
    }
  } catch (error) {
    return finish(check, startedAt, { ok: false, message: error.message });
  }
}

function finish(check, startedAt, result) {
  return {
    type: check.type,
    label: check.label ?? check.path ?? check.command ?? check.url ?? check.type,
    ok: result.ok,
    message: result.message,
    details: result.details,
    startedAt,
    finishedAt: nowIso()
  };
}

function fileExists(check, cwd) {
  const file = resolveInside(path.resolve(cwd), check.path);
  const ok = existsSync(file);
  return { ok, message: ok ? "exists" : `missing: ${check.path}` };
}

async function jsonFileValid(check, cwd) {
  const file = resolveInside(path.resolve(cwd), check.path);
  try {
    JSON.parse(await readFile(file, "utf8"));
    return { ok: true, message: "valid json" };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

async function commandCheck(check, cwd) {
  const timeout = Number(check.timeoutMs ?? 30000);
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const result = await execFileAsync(check.command, check.args ?? [], {
      cwd,
      timeout,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 8
    });
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
  } catch (error) {
    stdout = error.stdout ?? "";
    stderr = error.stderr ?? "";
    exitCode = typeof error.code === "number" ? error.code : 1;
    if (error.killed) stderr += "\nprocess timed out";
  }
  const expect = check.expect ?? {};
  const expectedExit = expect.exitCode ?? 0;
  const failures = [];
  if (exitCode !== expectedExit) failures.push(`exit ${exitCode}, expected ${expectedExit}`);
  for (const snippet of expect.stdoutIncludes ?? []) {
    if (!stdout.includes(snippet)) failures.push(`stdout missing: ${snippet}`);
  }
  for (const snippet of expect.stderrIncludes ?? []) {
    if (!stderr.includes(snippet)) failures.push(`stderr missing: ${snippet}`);
  }
  return {
    ok: failures.length === 0,
    message: failures.length ? failures.join("; ") : "command ok",
    details: {
      command: [check.command, ...(check.args ?? [])].join(" "),
      exitCode,
      stdoutTail: stdout.slice(-2000),
      stderrTail: stderr.slice(-2000)
    }
  };
}

async function gitSourceClean(check, cwd) {
  const config = await loadConfig(cwd);
  const runtimePaths = [...(config.runtimePaths ?? []), ...(check.runtimePaths ?? [])].map(normalizeRepoPath);
  let stdout = "";
  try {
    const result = await execFileAsync("git", ["status", "--porcelain=v1", "-b", "-uall"], {
      cwd,
      windowsHide: true,
      timeout: Number(check.timeoutMs ?? 30000)
    });
    stdout = result.stdout ?? "";
  } catch (error) {
    return { ok: false, message: error.message, details: { stderr: error.stderr } };
  }
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const entries = lines.filter((line) => !line.startsWith("## ")).map((line) => statusPath(line));
  const source = entries.filter((entry) => !runtimePaths.some((prefix) => normalizeRepoPath(entry.path).startsWith(prefix)));
  return {
    ok: source.length === 0,
    message: source.length ? `${source.length} source change(s)` : "source clean",
    details: { source, ignoredRuntimeCount: entries.length - source.length }
  };
}

function statusPath(line) {
  const raw = line.slice(3).trim();
  const value = raw.includes(" -> ") ? raw.split(" -> ").pop() : raw;
  return { status: line.slice(0, 2), path: value.replace(/^"|"$/g, "") };
}

async function claimRegistryValid(cwd) {
  const result = await validateClaimRegistry({ cwd });
  return {
    ok: result.ok,
    message: result.ok ? "claims valid" : result.errors.join("; "),
    details: result
  };
}

async function httpGet(check) {
  const response = await fetch(check.url, { method: "GET" });
  const text = await response.text();
  const expect = check.expect ?? {};
  const failures = [];
  if (expect.status !== undefined && response.status !== expect.status) {
    failures.push(`status ${response.status}, expected ${expect.status}`);
  }
  for (const snippet of expect.bodyIncludes ?? []) {
    if (!text.includes(snippet)) failures.push(`body missing: ${snippet}`);
  }
  return {
    ok: failures.length === 0,
    message: failures.length ? failures.join("; ") : "http ok",
    details: { status: response.status, bodyTail: text.slice(-1000) }
  };
}

async function markdownLinksValid(check, cwd) {
  const root = path.resolve(cwd);
  const files = check.files?.length ? check.files.map((file) => resolveInside(root, file)) : await walk(root, { extensions: [".md"] });
  const missing = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const matches = text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g);
    for (const match of matches) {
      const target = match[1].split("#")[0].trim();
      if (!target || /^[a-z]+:/i.test(target) || target.startsWith("#")) continue;
      const clean = target.replace(/^<|>$/g, "");
      const resolved = path.resolve(path.dirname(file), clean);
      if (!existsSync(resolved)) missing.push(`${path.relative(root, file)} -> ${target}`);
    }
  }
  return {
    ok: missing.length === 0,
    message: missing.length ? `${missing.length} missing markdown link(s)` : "markdown links valid",
    details: { missing }
  };
}

async function secretScan(check, cwd) {
  const root = path.resolve(cwd);
  const files = await walk(root, {
    extensions: check.extensions ?? [".js", ".mjs", ".json", ".md", ".ps1", ".html", ".css"],
    ignore: [".git", "node_modules", "lab-room/runs", "lab-room/session-notes", "lab-room/runtime", "lab-room/claims", "lab-room/tools", "dist-public"]
  });
  const patterns = [
    { name: "github_pat", regex: /github_pat_[A-Za-z0-9_]{20,}/ },
    { name: "github_token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/ },
    { name: "openai_key", regex: /sk-[A-Za-z0-9]{20,}/ },
    { name: "bearer_token", regex: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
    { name: "private_key", regex: /-----BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY-----/ }
  ];
  const hits = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(text)) hits.push(`${path.relative(root, file)}:${pattern.name}`);
    }
  }
  return {
    ok: hits.length === 0,
    message: hits.length ? `${hits.length} possible secret(s)` : "no obvious secrets",
    details: { hits }
  };
}

async function todoComplete(check, cwd) {
  const root = path.resolve(cwd);
  const file = resolveInside(root, check.path ?? "docs/everything-i-want-todo.md");
  const text = await readFile(file, "utf8");
  const open = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line }))
    .filter((line) => /^- \[ \]/.test(line.text));
  return {
    ok: open.length === 0,
    message: open.length ? `${open.length} incomplete TODO item(s)` : "todo complete",
    details: { open }
  };
}

export async function readLastRuns({ cwd = process.cwd(), limit = 20 } = {}) {
  const runsPath = labPaths(cwd).runs;
  const content = await readJsonLines(runsPath);
  return content.slice(-limit);
}

async function readJsonLines(file) {
  if (!existsSync(file)) return [];
  const text = await readFile(file, "utf8");
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function walk(root, options = {}) {
  const output = [];
  const rootResolved = path.resolve(root);
  const ignore = new Set(options.ignore ?? [".git", "node_modules", "dist-public"]);
  async function visit(current) {
    const relative = path.relative(rootResolved, current).replace(/\\/g, "/");
    if (relative && [...ignore].some((item) => relative === item || relative.startsWith(`${item}/`))) return;
    const info = await stat(current);
    if (info.isDirectory()) {
      for (const entry of await readdir(current)) await visit(path.join(current, entry));
      return;
    }
    if (!options.extensions || options.extensions.includes(path.extname(current))) output.push(current);
  }
  await visit(rootResolved);
  return output;
}
