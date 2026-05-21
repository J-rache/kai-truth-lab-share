import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendJsonl, labPaths, makeId, nowIso, readJson, writeJson } from "./store.mjs";

const execFileAsync = promisify(execFile);

export async function addMirrorPlan(input, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const url = validateMirrorUrl(input.url);
  const registry = await readJson(paths.mirrors, { schema: "codex-truth-lab.mirrors.v1", mirrors: [] });
  const mirror = {
    id: input.id || makeId("mirror"),
    host: input.host || inferHost(url),
    url,
    remote: input.remote || input.remoteName || inferRemoteName(url),
    purpose: input.purpose || "backup",
    visibility: input.visibility || "unknown",
    status: "planned",
    verifiedAt: null,
    lastError: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const existing = registry.mirrors.findIndex((item) => item.id === mirror.id);
  if (existing >= 0) {
    mirror.createdAt = registry.mirrors[existing].createdAt;
    registry.mirrors[existing] = { ...registry.mirrors[existing], ...mirror };
  } else {
    registry.mirrors.push(mirror);
  }
  await writeJson(paths.mirrors, registry);
  await appendJsonl(paths.mirrorEvents, { event: "planned", mirror });
  return mirror;
}

export async function listMirrorPlans({ cwd = process.cwd() } = {}) {
  const registry = await readJson(labPaths(cwd).mirrors, { schema: "codex-truth-lab.mirrors.v1", mirrors: [] });
  return registry.mirrors ?? [];
}

export async function verifyMirrorPlan(id, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const registry = await readJson(paths.mirrors, { schema: "codex-truth-lab.mirrors.v1", mirrors: [] });
  const index = registry.mirrors.findIndex((item) => item.id === id);
  if (index < 0) throw new Error(`Mirror plan not found: ${id}`);
  const mirror = registry.mirrors[index];
  const result = await runGitLsRemote(mirror.url, cwd);
  const updated = {
    ...mirror,
    status: result.ok ? "verified" : "unverified",
    verifiedAt: nowIso(),
    lastError: result.ok ? null : result.stderrTail || result.stdoutTail || `exit ${result.exitCode}`,
    updatedAt: nowIso()
  };
  registry.mirrors[index] = updated;
  await writeJson(paths.mirrors, registry);
  await appendJsonl(paths.mirrorEvents, { event: "verified", mirror: updated, result });
  return { mirror: updated, result };
}

export function validateMirrorUrl(value) {
  if (!value) throw new Error("Mirror URL is required");
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Mirror URL must be a valid URL");
  }
  if (url.protocol !== "https:") throw new Error("Mirror URL must use https");
  if (url.username || url.password || value.match(/:\/\/[^/]+@/)) {
    throw new Error("Mirror URL must not contain credentials");
  }
  if (!url.pathname.endsWith(".git")) throw new Error("Mirror URL must end in .git");
  return url.toString();
}

function inferHost(url) {
  const host = new URL(url).hostname.toLowerCase();
  if (host.includes("gitlab")) return "gitlab";
  if (host.includes("github")) return "github";
  return host;
}

function inferRemoteName(url) {
  const host = inferHost(url);
  if (host === "gitlab" || host === "github") return host;
  return "mirror";
}

async function runGitLsRemote(url, cwd) {
  const startedAt = nowIso();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const result = await execFileAsync("git", ["ls-remote", url, "HEAD"], {
      cwd,
      windowsHide: true,
      timeout: 60000,
      maxBuffer: 1024 * 1024
    });
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
  } catch (error) {
    stdout = error.stdout ?? "";
    stderr = error.stderr ?? "";
    exitCode = typeof error.code === "number" ? error.code : 1;
  }
  return {
    ok: exitCode === 0,
    command: `git ls-remote ${url} HEAD`,
    exitCode,
    stdoutTail: stdout.slice(-1000),
    stderrTail: stderr.slice(-1000),
    startedAt,
    finishedAt: nowIso()
  };
}
