import { existsSync } from "node:fs";
import path from "node:path";
import { appendJsonl, labPaths, makeId, nowIso } from "./store.mjs";

const candidates = [
  {
    id: "proof-bundles",
    title: "Generate durable proof bundles",
    reason: "Final answers should be backed by a reusable artifact, not only a chat summary.",
    files: ["src/proof-bundle.mjs", "docs/proof-bundles.md"]
  },
  {
    id: "repo-redundancy",
    title: "Track GitHub/GitLab redundancy plans",
    reason: "Backup and public-share destinations should be explicit, clean, and verifiable per repo.",
    files: ["src/repo-redundancy.mjs", "docs/redundancy.md"]
  },
  {
    id: "self-directed-decisions",
    title: "Record next-work decisions",
    reason: "When freedom is granted, the lab should record what it chose and why instead of waiting silently.",
    files: ["src/next-work.mjs"]
  }
];

export async function decideNextWork({ cwd = process.cwd(), question = "What should the lab do next?" } = {}) {
  const decision = pickCandidate(cwd);
  const record = {
    id: makeId("next"),
    question,
    decision: decision.id,
    title: decision.title,
    reason: decision.reason,
    status: decision.complete ? "complete_for_now" : "ready_to_execute",
    decidedAt: nowIso()
  };
  await appendJsonl(labPaths(cwd).nextWorkDecisions, record);
  return record;
}

export async function listNextWorkDecisions({ cwd = process.cwd() } = {}) {
  const file = labPaths(cwd).nextWorkDecisions;
  const raw = await import("node:fs/promises").then(({ readFile }) => readFile(file, "utf8").catch(() => ""));
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function nextWorkStatus({ cwd = process.cwd() } = {}) {
  return {
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      complete: candidate.files.every((file) => existsSync(path.join(cwd, file)))
    })),
    decisions: await listNextWorkDecisions({ cwd })
  };
}

function pickCandidate(cwd) {
  for (const candidate of candidates) {
    const complete = candidate.files.every((file) => existsSync(path.join(cwd, file)));
    if (!complete) return { ...candidate, complete };
  }
  return {
    id: "maintenance-autonomy",
    title: "Run autonomy and repair failures",
    reason: "The current known desired build pieces exist, so the next choice is to run the gates and fix anything real.",
    complete: true
  };
}
