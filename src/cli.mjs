#!/usr/bin/env node
import { addClaim, addTool, initLab, labStatus, listEvaluations, promoteClaim, writeSessionNote } from "./lab.mjs";
import { runEvaluation } from "./evaluators.mjs";
import { renderSourceStatus, sourceStatus } from "./source-status.mjs";
import { runAutonomyCycle } from "./autonomy.mjs";
import { closeFailure, listFailures, recordFailure } from "./failure-inbox.mjs";
import { createMystroCompletionHandoff } from "./mystro-bridge.mjs";
import { recordToolPromotion } from "./tool-promotion.mjs";
import { createProofBundle, listProofBundles } from "./proof-bundle.mjs";
import { addMirrorPlan, listMirrorPlans, verifyMirrorPlan } from "./repo-redundancy.mjs";
import { decideNextWork, listNextWorkDecisions } from "./next-work.mjs";

const args = process.argv.slice(2);
const flags = parseFlags(args);

async function main() {
  const [group, action, subject] = flags.positionals;
  if (!group || group === "help" || group === "--help") return usage();

  if (group === "init") {
    const status = await initLab();
    return print(status);
  }

  if (group === "status") {
    const status = await labStatus();
    return print(status);
  }

  if (group === "source-status") {
    const status = await sourceStatus({ failOnSource: flags.values["fail-on-source"] === true });
    if (flags.values.json) console.log(JSON.stringify(status, null, 2));
    else console.log(renderSourceStatus(status));
    process.exitCode = status.ok ? 0 : 1;
    return;
  }

  if (group === "eval" && action === "list") {
    return print(await listEvaluations());
  }

  if (group === "eval" && action === "run") {
    if (!subject) throw new Error("evaluation id is required");
    const run = await runEvaluation(subject);
    return print(run, run.status === "passed" ? 0 : 1);
  }

  if (group === "autonomy" && action === "run") {
    const cycle = await runAutonomyCycle({ writeFailures: flags.values["no-failure-write"] !== true });
    return print(cycle, cycle.status === "passed" ? 0 : 1);
  }

  if (group === "next" && action === "decide") {
    return print(await decideNextWork({ question: flags.values.question }));
  }

  if (group === "next" && action === "list") {
    return print(await listNextWorkDecisions());
  }

  if (group === "proof" && action === "bundle") {
    const commands = flags.values["quick"] === true ? [{ id: "source-status", command: "node", args: ["src/cli.mjs", "source-status", "--json", "--fail-on-source"], timeoutMs: 30000 }] : undefined;
    const bundle = await createProofBundle({ label: flags.values.label ?? "proof", commands });
    return print(bundle, bundle.status === "passed" ? 0 : 1);
  }

  if (group === "proof" && action === "list") {
    return print(await listProofBundles());
  }

  if (group === "mirror" && action === "plan") {
    return print(await addMirrorPlan({
      id: flags.values.id,
      host: flags.values.host,
      url: flags.values.url,
      remote: flags.values.remote,
      purpose: flags.values.purpose,
      visibility: flags.values.visibility
    }));
  }

  if (group === "mirror" && action === "list") {
    return print(await listMirrorPlans());
  }

  if (group === "mirror" && action === "verify") {
    if (!subject) throw new Error("mirror id is required");
    const result = await verifyMirrorPlan(subject);
    return print(result, result.result.ok ? 0 : 1);
  }

  if (group === "failures" && action === "list") {
    return print(await listFailures({ includeClosed: flags.values.all === true }));
  }

  if (group === "failures" && action === "add") {
    return print(await recordFailure({
      source: flags.values.source,
      severity: flags.values.severity,
      summary: flags.values.summary,
      details: flags.values.details,
      evidence: collect(flags.values.evidence)
    }));
  }

  if (group === "failures" && action === "close") {
    if (!subject) throw new Error("failure id is required");
    return print(await closeFailure(subject, flags.values.note ?? ""));
  }

  if (group === "mystro" && action === "handoff") {
    return print(await createMystroCompletionHandoff({
      projectId: flags.values.project ?? "unknown",
      evalId: flags.values.eval ?? "completion-gate",
      mystroUrl: flags.values["mystro-url"]
    }));
  }

  if (group === "tool" && action === "promote") {
    return print(await recordToolPromotion({
      id: flags.values.id,
      name: flags.values.name,
      path: flags.values.path,
      verification: collect(flags.values.verify),
      permissions: collect(flags.values.permission),
      limits: collect(flags.values.limit),
      publicSafe: flags.values["public-safe"] === true
    }));
  }

  if (group === "claim" && action === "add") {
    const claim = await addClaim({
      title: flags.values.title,
      body: flags.values.body,
      state: flags.values.state,
      evidence: flags.values.evidence
    });
    return print(claim);
  }

  if (group === "claim" && action === "promote") {
    if (!subject) throw new Error("claim id is required");
    const claim = await promoteClaim(subject, {
      state: flags.values.state,
      evidence: flags.values.evidence
    });
    return print(claim);
  }

  if (group === "tool" && action === "add") {
    const tool = await addTool({
      id: flags.values.id,
      name: flags.values.name,
      path: flags.values.path,
      category: flags.values.category,
      verification: collect(flags.values.verify),
      howToStart: collect(flags.values.start),
      permissions: collect(flags.values.permission),
      limits: collect(flags.values.limit)
    });
    return print(tool);
  }

  if (group === "note" && action === "add") {
    const note = await writeSessionNote({
      summary: flags.values.summary,
      details: flags.values.details,
      evidence: collect(flags.values.evidence)
    });
    return print(note);
  }

  usage();
  process.exitCode = 1;
}

function parseFlags(input) {
  const positionals = [];
  const values = {};
  for (let index = 0; index < input.length; index += 1) {
    const item = input[index];
    if (!item.startsWith("--")) {
      positionals.push(item);
      continue;
    }
    const key = item.slice(2);
    if (key === "json") {
      values.json = true;
      continue;
    }
    if (["fail-on-source", "no-failure-write", "all", "public-safe", "quick"].includes(key)) {
      values[key] = true;
      continue;
    }
    const value = input[index + 1];
    index += 1;
    if (values[key] === undefined) values[key] = value;
    else if (Array.isArray(values[key])) values[key].push(value);
    else values[key] = [values[key], value];
  }
  return { positionals, values };
}

function collect(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function print(value, exitCode = 0) {
  if (flags.values.json) console.log(JSON.stringify(value, null, 2));
  else console.log(render(value));
  process.exitCode = exitCode;
}

function render(value) {
  if (Array.isArray(value)) {
    return value.map((item) => render(item)).join("\n");
  }
  if (value?.status && value?.checks) {
    return [
      `${value.evaluationId}: ${value.status}`,
      ...value.checks.map((check) => `- ${check.ok ? "PASS" : "FAIL"} ${check.label}: ${check.message}`)
    ].join("\n");
  }
  if (value?.ok && value?.labName) {
    return `${value.labName}\nroot: ${value.root}\nevals: ${value.evalsPath}\nclaims: ${value.claims}\ntools: ${value.tools}\nattached clients: ${value.attachedClients}`;
  }
  return JSON.stringify(value, null, 2);
}

function usage() {
  console.log(`Codex Truth Lab

Usage:
  node src/cli.mjs init [--json]
  node src/cli.mjs status [--json]
  node src/cli.mjs source-status [--json] [--fail-on-source]
  node src/cli.mjs autonomy run [--json]
  node src/cli.mjs next decide [--question <question>] [--json]
  node src/cli.mjs next list [--json]
  node src/cli.mjs proof bundle [--label <label>] [--quick] [--json]
  node src/cli.mjs proof list [--json]
  node src/cli.mjs mirror plan --url <https://gitlab.com/group/project.git> [--id <id>] [--host gitlab] [--remote gitlab]
  node src/cli.mjs mirror list [--json]
  node src/cli.mjs mirror verify <id> [--json]
  node src/cli.mjs eval list [--json]
  node src/cli.mjs eval run <id> [--json]
  node src/cli.mjs failures list [--json] [--all]
  node src/cli.mjs failures add --summary <summary> [--source <source>] [--severity <severity>]
  node src/cli.mjs claim add --title <title> [--body <body>] [--state <state>] [--evidence <evidence>]
  node src/cli.mjs claim promote <id> --state <state> --evidence <evidence>
  node src/cli.mjs tool add --id <id> --name <name> --path <path> [--verify <command>]
  node src/cli.mjs tool promote --id <id> --name <name> --path <path> --verify <command> [--public-safe]
  node src/cli.mjs mystro handoff --project <project-id> [--eval completion-gate] [--mystro-url http://127.0.0.1:8787]
  node src/cli.mjs note add --summary <summary> [--details <details>] [--evidence <evidence>]
`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
