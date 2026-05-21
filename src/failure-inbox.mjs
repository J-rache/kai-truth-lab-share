import { appendJsonl, labPaths, makeId, nowIso, readJson, writeJson } from "./store.mjs";

export async function recordFailure(input, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const failure = {
    id: input.id ?? makeId("fail"),
    status: "open",
    severity: input.severity ?? "medium",
    source: input.source ?? "unknown",
    summary: required(input.summary, "summary"),
    details: input.details ?? "",
    evidence: input.evidence ?? [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await appendJsonl(paths.failures, failure);
  const registry = await readJson(paths.openFailures, { schema: "codex-truth-lab.failures.v1", failures: [] });
  registry.failures = [
    ...(registry.failures ?? []).filter((item) => item.id !== failure.id),
    failure
  ];
  await writeJson(paths.openFailures, registry);
  return failure;
}

export async function listFailures({ cwd = process.cwd(), includeClosed = false } = {}) {
  const paths = labPaths(cwd);
  const registry = await readJson(paths.openFailures, { schema: "codex-truth-lab.failures.v1", failures: [] });
  const failures = registry.failures ?? [];
  return includeClosed ? failures : failures.filter((failure) => failure.status !== "closed");
}

export async function closeFailure(id, note = "", { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const registry = await readJson(paths.openFailures, { schema: "codex-truth-lab.failures.v1", failures: [] });
  const failure = (registry.failures ?? []).find((item) => item.id === id);
  if (!failure) throw new Error(`Failure not found: ${id}`);
  failure.status = "closed";
  failure.closedAt = nowIso();
  failure.updatedAt = failure.closedAt;
  failure.closeNote = note;
  await writeJson(paths.openFailures, registry);
  await appendJsonl(paths.failures, { ...failure, event: "closed" });
  return failure;
}

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") throw new Error(`${label} is required`);
  return String(value);
}

