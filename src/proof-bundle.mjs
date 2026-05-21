import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { appendJsonl, labPaths, makeId, nowIso, readJson, writeJson } from "./store.mjs";

const execFileAsync = promisify(execFile);

export const defaultProofCommands = [
  { id: "source-status", command: "node", args: ["src/cli.mjs", "source-status", "--json", "--fail-on-source"], timeoutMs: 30000 },
  { id: "completion-gate", command: "node", args: ["src/cli.mjs", "eval", "run", "completion-gate", "--json"], timeoutMs: 180000 },
  { id: "lab-self-check", command: "node", args: ["src/cli.mjs", "eval", "run", "lab-self-check", "--json"], timeoutMs: 240000 }
];

export async function createProofBundle({ cwd = process.cwd(), label = "proof", commands = defaultProofCommands } = {}) {
  const paths = labPaths(cwd);
  const startedAt = nowIso();
  const git = {
    status: await runGit(cwd, ["status", "--porcelain=v1", "-b", "-uall"]),
    head: await runGit(cwd, ["rev-parse", "HEAD"]),
    branch: await runGit(cwd, ["branch", "--show-current"])
  };
  const currentBranch = commandText(git.branch) || "HEAD";
  git.remoteHead = await runGit(cwd, ["ls-remote", "origin", `refs/heads/${currentBranch}`]);

  const checks = [];
  for (const command of commands) {
    checks.push(await runCommand(command, cwd));
  }
  const failed = checks.filter((check) => !check.ok);
  const bundle = {
    id: makeId("proof"),
    label,
    status: failed.length ? "failed" : "passed",
    startedAt,
    finishedAt: nowIso(),
    git,
    checks
  };
  const jsonFile = path.join(paths.proofBundlesDir, `${bundle.id}.json`);
  const markdownFile = path.join(paths.proofBundlesDir, `${bundle.id}.md`);
  await writeJson(jsonFile, bundle);
  await writeJson(paths.proofBundles, await appendBundleIndex(paths.proofBundles, bundle, jsonFile, markdownFile));
  await appendJsonl(path.join(paths.proofBundlesDir, "bundle-events.jsonl"), {
    id: bundle.id,
    label: bundle.label,
    status: bundle.status,
    finishedAt: bundle.finishedAt,
    jsonFile,
    markdownFile
  });
  await writeMarkdown(markdownFile, bundle);
  return { ...bundle, files: { json: jsonFile, markdown: markdownFile } };
}

export async function listProofBundles({ cwd = process.cwd() } = {}) {
  const registry = await readJson(labPaths(cwd).proofBundles, { schema: "codex-truth-lab.proof-bundles.v1", bundles: [] });
  return registry.bundles ?? [];
}

async function appendBundleIndex(file, bundle, jsonFile, markdownFile) {
  const registry = await readJson(file, { schema: "codex-truth-lab.proof-bundles.v1", bundles: [] });
  registry.bundles = [
    ...(registry.bundles ?? []),
    {
      id: bundle.id,
      label: bundle.label,
      status: bundle.status,
      finishedAt: bundle.finishedAt,
      head: commandText(bundle.git.head),
      files: { json: jsonFile, markdown: markdownFile }
    }
  ].slice(-50);
  return registry;
}

async function writeMarkdown(file, bundle) {
  const lines = [
    `# Proof Bundle ${bundle.id}`,
    "",
    `Label: ${bundle.label}`,
    `Status: ${bundle.status}`,
    `Started: ${bundle.startedAt}`,
    `Finished: ${bundle.finishedAt}`,
    `Branch: ${commandText(bundle.git.branch) || "unknown"}`,
    `Head: ${commandText(bundle.git.head) || "unknown"}`,
    `Remote head: ${commandText(bundle.git.remoteHead) || bundle.git.remoteHead.stderrTail || "unverified"}`,
    "",
    "## Checks",
    "",
    ...bundle.checks.map((check) => `- ${check.ok ? "PASS" : "FAIL"} ${check.id}: ${check.command}`)
  ];
  await import("node:fs/promises").then(({ writeFile }) => writeFile(file, `${lines.join("\n")}\n`, "utf8"));
}

function commandText(result) {
  return (result.stdoutTail ?? "").trim();
}

async function runGit(cwd, args) {
  return runCommand({ id: `git ${args[0]}`, command: "git", args, timeoutMs: 30000 }, cwd);
}

async function runCommand(check, cwd) {
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
