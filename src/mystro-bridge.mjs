import path from "node:path";
import { runEvaluation } from "./evaluators.mjs";
import { labPaths, makeId, nowIso, writeJson } from "./store.mjs";

export async function createMystroCompletionHandoff(input = {}, { cwd = process.cwd() } = {}) {
  const evalId = input.evalId ?? "completion-gate";
  const run = await runEvaluation(evalId, { cwd });
  const handoff = {
    id: makeId("mystro_handoff"),
    projectId: input.projectId ?? "unknown",
    evalId,
    status: run.status === "passed" ? "ready_for_mystro_review" : "blocked_by_truth_lab",
    runId: run.id,
    runStatus: run.status,
    summary:
      run.status === "passed"
        ? `Truth Lab gate ${evalId} passed. Mystro can proceed with final review.`
        : `Truth Lab gate ${evalId} failed. Mystro should not call complete.`,
    createdAt: nowIso(),
    run
  };
  const paths = labPaths(cwd);
  const file = path.join(paths.mystroHandoffsDir, `${handoff.id}.json`);
  await writeJson(file, handoff);
  if (input.mystroUrl) {
    handoff.mystroPost = await postMystroNote(input.mystroUrl, handoff);
    await writeJson(file, handoff);
  }
  return { ...handoff, file };
}

async function postMystroNote(baseUrl, handoff) {
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/stenographer/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        kind: "truth_lab_completion_gate",
        summary: handoff.summary,
        details: `Truth Lab handoff ${handoff.id}\nRun ${handoff.runId}\nStatus ${handoff.runStatus}`,
        touchedFiles: [handoff.file].filter(Boolean)
      })
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, payload };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

