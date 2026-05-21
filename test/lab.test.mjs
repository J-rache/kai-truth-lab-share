import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { addClaim, addTool, initLab, labStatus, promoteClaim, validateClaimRegistry } from "../src/lab.mjs";
import { runCheck, runEvaluation } from "../src/evaluators.mjs";
import { runAutonomyCycle } from "../src/autonomy.mjs";
import { closeFailure, listFailures, recordFailure } from "../src/failure-inbox.mjs";
import { createMystroCompletionHandoff } from "../src/mystro-bridge.mjs";
import { recordToolPromotion } from "../src/tool-promotion.mjs";

async function tempLab() {
  const dir = await mkdtemp(path.join(tmpdir(), "truth-lab-"));
  await initLab({ cwd: dir });
  return dir;
}

test("init creates a usable lab room", async () => {
  const dir = await tempLab();
  const status = await labStatus({ cwd: dir });
  assert.equal(status.ok, true);
  assert.equal(status.claims, 0);
  assert.equal(status.tools, 0);
});

test("claim promotion requires evidence for proven states", async () => {
  const dir = await tempLab();
  const claim = await addClaim({ title: "Bold idea", state: "hypothesis" }, { cwd: dir });
  await assert.rejects(
    () => promoteClaim(claim.id, { state: "machine_proven" }, { cwd: dir }),
    /Evidence is required/
  );
  const promoted = await promoteClaim(claim.id, { state: "machine_proven", evidence: "node --test passed" }, { cwd: dir });
  assert.equal(promoted.state, "machine_proven");
  const valid = await validateClaimRegistry({ cwd: dir });
  assert.equal(valid.ok, true);
});

test("tool registry stores verification recipes as pointers", async () => {
  const dir = await tempLab();
  const tool = await addTool(
    { id: "sample", name: "Sample", path: ".", verification: ["npm test"], limits: ["pointer only"] },
    { cwd: dir }
  );
  assert.equal(tool.id, "sample");
  const status = await labStatus({ cwd: dir });
  assert.equal(status.tools, 1);
});

test("evaluation runner persists pass and fail results", async () => {
  const dir = await tempLab();
  await writeFile(
    path.join(dir, "lab-room", "evals", "tiny.json"),
    JSON.stringify(
      {
        id: "tiny",
        name: "Tiny",
        checks: [
          { type: "file_exists", path: "lab-room/lab-config.json" },
          { type: "command", command: "node", args: ["-e", "console.log('ok')"], expect: { exitCode: 0, stdoutIncludes: ["ok"] } }
        ]
      },
      null,
      2
    )
  );
  const run = await runEvaluation("tiny", { cwd: dir });
  assert.equal(run.status, "passed");
  assert.equal(run.checks.length, 2);
});

test("todo completion check fails on open items", async () => {
  const dir = await tempLab();
  await writeFile(path.join(dir, "todo.md"), "- [x] done\n- [ ] open\n");
  const result = await runCheck({ type: "todo_complete", path: "todo.md" }, { cwd: dir });
  assert.equal(result.ok, false);
  assert.match(result.message, /incomplete/);
});

test("secret scan catches obvious private key blocks", async () => {
  const dir = await tempLab();
  const marker = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
  await writeFile(path.join(dir, "bad.md"), `${marker}\nsecret\n-----END PRIVATE KEY-----\n`);
  const result = await runCheck({ type: "secret_scan", extensions: [".md"] }, { cwd: dir });
  assert.equal(result.ok, false);
  assert.match(result.message, /possible secret/);
});

test("markdown link check catches missing relative targets", async () => {
  const dir = await tempLab();
  await writeFile(path.join(dir, "links.md"), "[missing](docs/nope.md)\n");
  const result = await runCheck({ type: "markdown_links_valid", files: ["links.md"] }, { cwd: dir });
  assert.equal(result.ok, false);
  assert.match(result.message, /missing markdown/);
});

test("failure inbox records and closes durable failures", async () => {
  const dir = await tempLab();
  const failure = await recordFailure({ summary: "Gate failed", source: "test" }, { cwd: dir });
  assert.equal((await listFailures({ cwd: dir })).length, 1);
  await closeFailure(failure.id, "fixed", { cwd: dir });
  assert.equal((await listFailures({ cwd: dir })).length, 0);
});

test("tool promotion classifies private and public tools", async () => {
  const dir = await tempLab();
  const rejected = await recordToolPromotion({ id: "no-verify", name: "No Verify", path: "." }, { cwd: dir });
  assert.equal(rejected.decision, "reject_until_verified");
  const privateOnly = await recordToolPromotion({ id: "secret-tool", name: "Secret Tool", path: ".", verification: ["npm test"], permissions: ["token"] }, { cwd: dir });
  assert.equal(privateOnly.decision, "private_toolbox_only");
  const publicTool = await recordToolPromotion({ id: "public-tool", name: "Public Tool", path: ".", verification: ["npm test"], publicSafe: true }, { cwd: dir });
  assert.equal(publicTool.decision, "public_share_candidate");
});

test("mystro handoff blocks on failed gate and records file", async () => {
  const dir = await tempLab();
  await writeFile(
    path.join(dir, "lab-room", "evals", "bad-gate.json"),
    JSON.stringify({ id: "bad-gate", name: "Bad Gate", checks: [{ type: "file_exists", path: "missing.txt" }] }, null, 2)
  );
  const handoff = await createMystroCompletionHandoff({ projectId: "test", evalId: "bad-gate" }, { cwd: dir });
  assert.equal(handoff.status, "blocked_by_truth_lab");
  assert.match(handoff.file, /mystro-handoffs/);
});

test("autonomy cycle records failures when checks fail", async () => {
  const dir = await tempLab();
  const cycle = await runAutonomyCycle({
    cwd: dir,
    checks: [{ id: "bad-command", command: process.execPath, args: ["-e", "process.exit(2)"] }]
  });
  assert.equal(cycle.status, "failed");
  assert.equal((await listFailures({ cwd: dir })).length, 1);
});

test("autonomy cycle resolves npm command on the host platform", async () => {
  const dir = await tempLab();
  const cycle = await runAutonomyCycle({
    cwd: dir,
    checks: [{ id: "node-ok", command: process.execPath, args: ["-e", "process.exit(0)"] }]
  });
  assert.equal(cycle.status, "passed");
});
