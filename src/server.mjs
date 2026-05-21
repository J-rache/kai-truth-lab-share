import http from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addClaim, addTool, attachSeat, heartbeatSeat, initLab, labStatus, listClaims, listEvaluations, listSeats, listSessionNotes, listTools, writeSessionNote } from "./lab.mjs";
import { readLastRuns, runEvaluation } from "./evaluators.mjs";
import { sourceStatus } from "./source-status.mjs";
import { listFailures, recordFailure } from "./failure-inbox.mjs";
import { runAutonomyCycle } from "./autonomy.mjs";
import { recordToolPromotion } from "./tool-promotion.mjs";
import { createMystroCompletionHandoff } from "./mystro-bridge.mjs";
import { createProofBundle, listProofBundles } from "./proof-bundle.mjs";
import { addMirrorPlan, listMirrorPlans, verifyMirrorPlan } from "./repo-redundancy.mjs";
import { decideNextWork, listNextWorkDecisions } from "./next-work.mjs";

const port = Number(process.env.TRUTH_LAB_PORT ?? 8799);
const cwd = process.env.TRUTH_LAB_ROOT ?? process.cwd();
const appRoot = path.join(cwd, "app");

await initLab({ cwd });

const server = http.createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    json(response, error.statusCode ?? 500, { error: error.message });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Codex Truth Lab listening on http://127.0.0.1:${port}`);
});

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (request.method === "GET" && url.pathname === "/health") {
    return json(response, 200, { ok: true, product: "codex-truth-lab" });
  }
  if (request.method === "GET" && url.pathname === "/") {
    return staticFile(response, "index.html");
  }
  if (request.method === "GET" && url.pathname === "/api/status") {
    return json(response, 200, await labStatus({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/source-status") {
    return json(response, 200, await sourceStatus({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/evals") {
    return json(response, 200, await listEvaluations({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/runs") {
    return json(response, 200, await readLastRuns({ cwd, limit: Number(url.searchParams.get("limit") ?? 20) }));
  }
  if (request.method === "GET" && url.pathname === "/api/claims") {
    return json(response, 200, await listClaims({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/tools") {
    return json(response, 200, await listTools({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/seats") {
    return json(response, 200, await listSeats({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/session-notes") {
    return json(response, 200, await listSessionNotes({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/failures") {
    return json(response, 200, await listFailures({ cwd, includeClosed: url.searchParams.get("all") === "1" }));
  }
  if (request.method === "GET" && url.pathname === "/api/proof-bundles") {
    return json(response, 200, await listProofBundles({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/mirrors") {
    return json(response, 200, await listMirrorPlans({ cwd }));
  }
  if (request.method === "GET" && url.pathname === "/api/next-work") {
    return json(response, 200, await listNextWorkDecisions({ cwd }));
  }
  const evalRun = url.pathname.match(/^\/api\/evals\/([^/]+)\/run$/);
  if (request.method === "POST" && evalRun) {
    const run = await runEvaluation(evalRun[1], { cwd });
    return json(response, run.status === "passed" ? 200 : 422, run);
  }
  if (request.method === "POST" && url.pathname === "/api/claims") {
    return json(response, 201, await addClaim(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/tools") {
    return json(response, 201, await addTool(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/session-notes") {
    return json(response, 201, await writeSessionNote(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/failures") {
    return json(response, 201, await recordFailure(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/autonomy/run") {
    const cycle = await runAutonomyCycle({ cwd });
    return json(response, cycle.status === "passed" ? 200 : 422, cycle);
  }
  if (request.method === "POST" && url.pathname === "/api/tools/promote") {
    return json(response, 201, await recordToolPromotion(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/mystro/handoff") {
    return json(response, 201, await createMystroCompletionHandoff(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/proof-bundles") {
    const input = await body(request);
    const bundle = await createProofBundle({ cwd, label: input.label ?? "dashboard-proof", commands: input.quick ? [{ id: "source-status", command: "node", args: ["src/cli.mjs", "source-status", "--json", "--fail-on-source"], timeoutMs: 30000 }] : undefined });
    return json(response, bundle.status === "passed" ? 201 : 422, bundle);
  }
  if (request.method === "POST" && url.pathname === "/api/mirrors") {
    return json(response, 201, await addMirrorPlan(await body(request), { cwd }));
  }
  const mirrorVerify = url.pathname.match(/^\/api\/mirrors\/([^/]+)\/verify$/);
  if (request.method === "POST" && mirrorVerify) {
    const result = await verifyMirrorPlan(mirrorVerify[1], { cwd });
    return json(response, result.result.ok ? 200 : 422, result);
  }
  if (request.method === "POST" && url.pathname === "/api/next-work/decide") {
    return json(response, 201, await decideNextWork({ cwd, ...(await body(request)) }));
  }
  if (request.method === "POST" && url.pathname === "/api/seats/attach") {
    return json(response, 201, await attachSeat(await body(request), { cwd }));
  }
  if (request.method === "POST" && url.pathname === "/api/seats/heartbeat") {
    return json(response, 200, await heartbeatSeat(await body(request), { cwd }));
  }
  if (request.method === "GET" && url.pathname.startsWith("/app/")) {
    return staticFile(response, url.pathname.slice("/app/".length));
  }
  json(response, 404, { error: "not found" });
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

async function staticFile(response, relativePath) {
  const clean = relativePath.replace(/^\/+/, "");
  const file = path.resolve(appRoot, clean);
  const appRootWithSep = appRoot.endsWith(path.sep) ? appRoot : `${appRoot}${path.sep}`;
  if (file !== appRoot && !file.startsWith(appRootWithSep)) {
    return json(response, 403, { error: "forbidden" });
  }
  if (!existsSync(file)) {
    return json(response, 404, { error: "not found" });
  }
  response.writeHead(200, { "content-type": contentType(file) });
  response.end(await readFile(file));
}

function contentType(file) {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".css")) return "text/css; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (file.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}
