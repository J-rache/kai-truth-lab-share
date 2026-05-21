import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendJsonl, labPaths, makeId, nowIso, writeJson } from "./store.mjs";
import { recordFailure } from "./failure-inbox.mjs";

const execFileAsync = promisify(execFile);

export const defaultAutonomyChecks = [
  { id: "verify", command: "npm", args: ["run", "verify"], timeoutMs: 240000 },
  { id: "completion-gate", command: "node", args: ["src/cli.mjs", "eval", "run", "completion-gate", "--json"], timeoutMs: 180000 },
  { id: "public-share-gate", command: "node", args: ["src/cli.mjs", "eval", "run", "public-share-gate", "--json"], timeoutMs: 180000 },
  { id: "model-seat-gate", command: "node", args: ["src/cli.mjs", "eval", "run", "model-seat-gate", "--json"], timeoutMs: 180000 },
  { id: "source-status", command: "node", args: ["src/cli.mjs", "source-status", "--fail-on-source"], timeoutMs: 30000 }
];

export async function runAutonomyCycle({ cwd = process.cwd(), checks = defaultAutonomyChecks, writeFailures = true } = {}) {
  const startedAt = nowIso();
  const results = [];
  for (const check of checks) {
    results.push(await runCommandCheck(check, cwd));
  }
  const failed = results.filter((result) => !result.ok);
  const cycle = {
    id: makeId("cycle"),
    status: failed.length ? "failed" : "passed",
    startedAt,
    finishedAt: nowIso(),
    checks: results
  };
  const paths = labPaths(cwd);
  await appendJsonl(paths.autonomyRuns, cycle);
  await writeJson(`${paths.autonomyDir}/latest-cycle.json`, cycle);
  if (writeFailures && failed.length) {
    await recordFailure(
      {
        source: "autonomy-cycle",
        severity: "high",
        summary: `Autonomy cycle ${cycle.id} failed ${failed.length} check(s)`,
        details: failed.map((item) => `${item.id}: ${item.message}`).join("\n"),
        evidence: failed.map((item) => item.command)
      },
      { cwd }
    );
  }
  return cycle;
}

async function runCommandCheck(check, cwd) {
  const startedAt = nowIso();
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    const resolved = resolveCommand(check.command, check.args ?? []);
    const result = await execFileAsync(resolved.command, resolved.args, {
      cwd,
      windowsHide: true,
      timeout: check.timeoutMs ?? 120000,
      maxBuffer: 1024 * 1024 * 12
    });
    stdout = result.stdout ?? "";
    stderr = result.stderr ?? "";
  } catch (error) {
    stdout = error.stdout ?? "";
    stderr = error.stderr ?? "";
    exitCode = typeof error.code === "number" ? error.code : 1;
    if (error.killed) stderr += "\nprocess timed out";
  }
  return {
    id: check.id,
    ok: exitCode === 0,
    command: [check.command, ...(check.args ?? [])].join(" "),
    exitCode,
    message: exitCode === 0 ? "ok" : `exit ${exitCode}`,
    stdoutTail: stdout.slice(-3000),
    stderrTail: stderr.slice(-3000),
    startedAt,
    finishedAt: nowIso()
  };
}

function resolveCommand(command, args) {
  if (process.platform === "win32" && command === "npm") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", ["npm", ...args].join(" ")] };
  }
  return { command, args };
}
