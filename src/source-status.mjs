import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "./store.mjs";

const execFileAsync = promisify(execFile);

export async function sourceStatus({ cwd = process.cwd(), failOnSource = false } = {}) {
  const config = await loadConfig(cwd);
  const runtimePaths = (config.runtimePaths ?? []).map(normalizePath);
  const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "-b", "-uall"], {
    cwd,
    windowsHide: true,
    timeout: 30000
  });
  const lines = stdout.split(/\r?\n/).filter(Boolean);
  const branch = lines.find((line) => line.startsWith("## ")) ?? "## unknown";
  const entries = lines.filter((line) => !line.startsWith("## ")).map((line) => ({
    status: line.slice(0, 2),
    path: statusPath(line),
    raw: line
  }));
  const runtime = entries.filter((entry) => runtimePaths.some((prefix) => normalizePath(entry.path).startsWith(prefix)));
  const source = entries.filter((entry) => !runtimePaths.some((prefix) => normalizePath(entry.path).startsWith(prefix)));
  return {
    ok: !failOnSource || source.length === 0,
    branch,
    source,
    runtime,
    runtimePaths
  };
}

export function renderSourceStatus(status) {
  const lines = [
    status.branch,
    `source changes: ${status.source.length ? status.source.length : "clean"}`
  ];
  for (const entry of status.source) lines.push(`  ${entry.status} ${entry.path}`);
  lines.push(`runtime changes: ${status.runtime.length ? status.runtime.length : "clean"}`);
  for (const entry of status.runtime.slice(0, 30)) lines.push(`  ${entry.status} ${entry.path}`);
  if (status.runtime.length > 30) lines.push(`  ... ${status.runtime.length - 30} more runtime paths`);
  return lines.join("\n");
}

function statusPath(line) {
  const raw = line.slice(3).trim();
  const value = raw.includes(" -> ") ? raw.split(" -> ").pop() : raw;
  return value.replace(/^"|"$/g, "");
}

function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

