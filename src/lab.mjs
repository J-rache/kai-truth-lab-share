import { existsSync } from "node:fs";
import path from "node:path";
import {
  appendJsonl,
  defaultConfig,
  ensureDir,
  labPaths,
  loadConfig,
  makeId,
  nowIso,
  readJson,
  resolveInside,
  writeJson
} from "./store.mjs";

export async function initLab({ cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  await ensureDir(paths.evals);
  await ensureDir(paths.claimsDir);
  await ensureDir(paths.toolsDir);
  await ensureDir(paths.runsDir);
  await ensureDir(paths.runtimeDir);
  await ensureDir(paths.sessionNotesDir);
  if (!existsSync(paths.config)) {
    await writeJson(paths.config, defaultConfig);
  }
  if (!existsSync(paths.claims)) {
    await writeJson(paths.claims, { schema: "codex-truth-lab.claims.v1", claims: [] });
  }
  if (!existsSync(paths.tools)) {
    await writeJson(paths.tools, { schema: "codex-truth-lab.tools.v1", tools: [] });
  }
  if (!existsSync(paths.seats)) {
    await writeJson(paths.seats, { schema: "codex-truth-lab.seats.v1", clients: [] });
  }
  return labStatus({ cwd });
}

export async function labStatus({ cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const config = await loadConfig(cwd);
  const claims = await readJson(paths.claims, { claims: [] });
  const tools = await readJson(paths.tools, { tools: [] });
  const seats = await readJson(paths.seats, { clients: [] });
  return {
    ok: true,
    labName: config.labName,
    root: paths.root,
    evalsPath: paths.evals,
    claims: claims.claims?.length ?? 0,
    tools: tools.tools?.length ?? 0,
    attachedClients: seats.clients?.filter((client) => client.status === "attached").length ?? 0,
    runtimePaths: config.runtimePaths
  };
}

export async function listEvaluations({ cwd = process.cwd() } = {}) {
  const { readdir } = await import("node:fs/promises");
  const paths = labPaths(cwd);
  if (!existsSync(paths.evals)) return [];
  const files = (await readdir(paths.evals)).filter((file) => file.endsWith(".json")).sort();
  const evals = [];
  for (const file of files) {
    const body = await readJson(path.join(paths.evals, file));
    evals.push({
      id: body.id ?? path.basename(file, ".json"),
      name: body.name ?? body.id ?? file,
      description: body.description ?? "",
      checks: Array.isArray(body.checks) ? body.checks.length : 0
    });
  }
  return evals;
}

export async function loadEvaluation(id, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const file = resolveInside(paths.evals, `${id}.json`);
  const evaluation = await readJson(file);
  if (!evaluation) throw new Error(`Evaluation not found: ${id}`);
  if (!Array.isArray(evaluation.checks)) throw new Error(`Evaluation has no checks: ${id}`);
  return evaluation;
}

export async function readClaims({ cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  return readJson(paths.claims, { schema: "codex-truth-lab.claims.v1", claims: [] });
}

export async function listClaims({ cwd = process.cwd() } = {}) {
  const registry = await readClaims({ cwd });
  return registry.claims ?? [];
}

export async function addClaim(input, { cwd = process.cwd() } = {}) {
  const config = await loadConfig(cwd);
  const state = input.state ?? "hypothesis";
  if (!config.claimStates.includes(state)) throw new Error(`Invalid claim state: ${state}`);
  if (config.evidenceRequiredFor.includes(state) && !input.evidence) {
    throw new Error(`Evidence is required for claim state: ${state}`);
  }
  const paths = labPaths(cwd);
  const registry = await readClaims({ cwd });
  const claim = {
    id: input.id ?? makeId("claim"),
    title: required(input.title, "title"),
    body: input.body ?? "",
    state,
    evidence: input.evidence ? [input.evidence] : [],
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  registry.claims.push(claim);
  await writeJson(paths.claims, registry);
  return claim;
}

export async function promoteClaim(id, input, { cwd = process.cwd() } = {}) {
  const config = await loadConfig(cwd);
  const nextState = required(input.state, "state");
  if (!config.claimStates.includes(nextState)) throw new Error(`Invalid claim state: ${nextState}`);
  if (config.evidenceRequiredFor.includes(nextState) && !input.evidence) {
    throw new Error(`Evidence is required for claim state: ${nextState}`);
  }
  const paths = labPaths(cwd);
  const registry = await readClaims({ cwd });
  const claim = registry.claims.find((item) => item.id === id);
  if (!claim) throw new Error(`Claim not found: ${id}`);
  claim.state = nextState;
  claim.updatedAt = nowIso();
  if (input.evidence) claim.evidence = [...(claim.evidence ?? []), input.evidence];
  await writeJson(paths.claims, registry);
  return claim;
}

export async function validateClaimRegistry({ cwd = process.cwd() } = {}) {
  const config = await loadConfig(cwd);
  const registry = await readClaims({ cwd });
  const errors = [];
  for (const claim of registry.claims ?? []) {
    if (!claim.id) errors.push("claim missing id");
    if (!claim.title) errors.push(`${claim.id ?? "unknown"} missing title`);
    if (!config.claimStates.includes(claim.state)) errors.push(`${claim.id} invalid state ${claim.state}`);
    if (config.evidenceRequiredFor.includes(claim.state) && !(claim.evidence ?? []).length) {
      errors.push(`${claim.id} state ${claim.state} requires evidence`);
    }
  }
  return { ok: errors.length === 0, errors, count: registry.claims?.length ?? 0 };
}

export async function readTools({ cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  return readJson(paths.tools, { schema: "codex-truth-lab.tools.v1", tools: [] });
}

export async function listTools({ cwd = process.cwd() } = {}) {
  const registry = await readTools({ cwd });
  return registry.tools ?? [];
}

export async function addTool(input, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const registry = await readTools({ cwd });
  const tool = {
    id: required(input.id, "id"),
    name: required(input.name, "name"),
    path: required(input.path, "path"),
    category: input.category ?? "general",
    permissions: input.permissions ?? [],
    howToStart: input.howToStart ?? [],
    verification: input.verification ?? [],
    limits: input.limits ?? [],
    addedAt: nowIso(),
    updatedAt: nowIso()
  };
  const existing = registry.tools.findIndex((item) => item.id === tool.id);
  if (existing >= 0) registry.tools[existing] = { ...registry.tools[existing], ...tool, addedAt: registry.tools[existing].addedAt };
  else registry.tools.push(tool);
  await writeJson(paths.tools, registry);
  return tool;
}

export async function attachSeat(input, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const registry = await readJson(paths.seats, { schema: "codex-truth-lab.seats.v1", clients: [] });
  const clientId = required(input.clientId, "clientId");
  const client = {
    clientId,
    label: input.label ?? clientId,
    model: input.model ?? "unknown",
    purpose: input.purpose ?? "",
    status: "attached",
    attachedAt: nowIso(),
    lastHeartbeatAt: nowIso(),
    focus: input.focus ?? ""
  };
  const existing = registry.clients.findIndex((item) => item.clientId === clientId);
  if (existing >= 0) registry.clients[existing] = { ...registry.clients[existing], ...client, attachedAt: registry.clients[existing].attachedAt };
  else registry.clients.push(client);
  await writeJson(paths.seats, registry);
  return client;
}

export async function heartbeatSeat(input, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const registry = await readJson(paths.seats, { schema: "codex-truth-lab.seats.v1", clients: [] });
  const clientId = required(input.clientId, "clientId");
  const client = registry.clients.find((item) => item.clientId === clientId);
  if (!client) throw new Error(`Client not attached: ${clientId}`);
  client.status = "attached";
  client.lastHeartbeatAt = nowIso();
  client.focus = input.focus ?? client.focus ?? "";
  await writeJson(paths.seats, registry);
  return client;
}

export async function listSeats({ cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  const registry = await readJson(paths.seats, { schema: "codex-truth-lab.seats.v1", clients: [] });
  return registry.clients ?? [];
}

export async function writeSessionNote(input, { cwd = process.cwd() } = {}) {
  const paths = labPaths(cwd);
  await ensureDir(paths.sessionNotesDir);
  const date = nowIso().slice(0, 10);
  const note = {
    id: makeId("note"),
    timestamp: nowIso(),
    summary: required(input.summary, "summary"),
    details: input.details ?? "",
    evidence: input.evidence ?? []
  };
  const file = path.join(paths.sessionNotesDir, `${date}.md`);
  const markdown = [
    `## ${note.timestamp}`,
    "",
    `Summary: ${note.summary}`,
    "",
    note.details,
    "",
    note.evidence.length ? `Evidence: ${note.evidence.join("; ")}` : ""
  ]
    .filter((line) => line !== "")
    .join("\n");
  const { appendFile } = await import("node:fs/promises");
  await appendFile(file, `${markdown}\n\n`, "utf8");
  await appendJsonl(path.join(paths.sessionNotesDir, "notes.jsonl"), note);
  return { ...note, file };
}

export async function listSessionNotes({ cwd = process.cwd(), limit = 20 } = {}) {
  const paths = labPaths(cwd);
  const file = path.join(paths.sessionNotesDir, "notes.jsonl");
  if (!existsSync(file)) return [];
  const { readFile } = await import("node:fs/promises");
  const notes = (await readFile(file, "utf8"))
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  return notes.slice(-limit);
}

function required(value, label) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`${label} is required`);
  }
  return String(value);
}
