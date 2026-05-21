import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const defaultConfig = {
  schema: "codex-truth-lab.config.v1",
  labName: "Codex Truth Lab",
  runtimePaths: [
    "lab-room/runs/",
    "lab-room/session-notes/",
    "lab-room/runtime/",
    "lab-room/claims/",
    "lab-room/tools/",
    "lab-room/autonomy/",
    "lab-room/failure-inbox/",
    "lab-room/mystro-handoffs/",
    "lab-room/tool-decisions/",
    "node_modules/"
  ],
  claimStates: ["hypothesis", "design_sketch", "unverified", "machine_proven", "source_backed", "production_ready"],
  evidenceRequiredFor: ["machine_proven", "source_backed", "production_ready"]
};

export function labPaths(cwd = process.cwd()) {
  const root = path.resolve(cwd);
  const labRoom = path.join(root, "lab-room");
  return {
    root,
    labRoom,
    config: path.join(labRoom, "lab-config.json"),
    evals: path.join(labRoom, "evals"),
    claimsDir: path.join(labRoom, "claims"),
    claims: path.join(labRoom, "claims", "claims.json"),
    toolsDir: path.join(labRoom, "tools"),
    tools: path.join(labRoom, "tools", "tools.json"),
    runsDir: path.join(labRoom, "runs"),
    runs: path.join(labRoom, "runs", "runs.jsonl"),
    runtimeDir: path.join(labRoom, "runtime"),
    seats: path.join(labRoom, "runtime", "seat-clients.json"),
    sessionNotesDir: path.join(labRoom, "session-notes"),
    autonomyDir: path.join(labRoom, "autonomy"),
    autonomyRuns: path.join(labRoom, "autonomy", "autonomy-runs.jsonl"),
    failureInboxDir: path.join(labRoom, "failure-inbox"),
    failures: path.join(labRoom, "failure-inbox", "failures.jsonl"),
    openFailures: path.join(labRoom, "failure-inbox", "open-failures.json"),
    mystroHandoffsDir: path.join(labRoom, "mystro-handoffs"),
    toolDecisionsDir: path.join(labRoom, "tool-decisions"),
    toolDecisions: path.join(labRoom, "tool-decisions", "decisions.jsonl")
  };
}

export function normalizeRepoPath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function resolveInside(root, relativePath) {
  const resolved = path.resolve(root, relativePath);
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    throw new Error(`Path escapes lab root: ${relativePath}`);
  }
  return resolved;
}

export async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

export async function readJson(file, fallback = undefined) {
  if (!existsSync(file)) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

export async function appendJsonl(file, value) {
  await ensureDir(path.dirname(file));
  await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
}

export async function loadConfig(cwd = process.cwd()) {
  const paths = labPaths(cwd);
  const config = await readJson(paths.config, defaultConfig);
  return { ...defaultConfig, ...config };
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}
