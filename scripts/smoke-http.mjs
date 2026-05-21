import { once } from "node:events";
import { spawn } from "node:child_process";

const port = 8899;
const env = { ...process.env, TRUTH_LAB_PORT: String(port) };
const child = spawn(process.execPath, ["src/server.mjs"], {
  cwd: process.cwd(),
  env,
  windowsHide: true,
  stdio: ["ignore", "pipe", "pipe"]
});

try {
  await waitForHealth(port);
  const status = await getJson(`http://127.0.0.1:${port}/api/status`);
  if (!status.ok) throw new Error("status not ok");
  const attach = await postJson(`http://127.0.0.1:${port}/api/seats/attach`, {
    clientId: "http-smoke",
    label: "HTTP Smoke",
    model: "node",
    purpose: "prove attach route"
  });
  if (attach.clientId !== "http-smoke") throw new Error("attach failed");
  const note = await postJson(`http://127.0.0.1:${port}/api/session-notes`, {
    summary: "HTTP smoke",
    details: "HTTP smoke completed."
  });
  if (!note.file) throw new Error("note failed");
  const html = await fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());
  if (!html.includes("Codex Truth Lab")) throw new Error("dashboard html missing");
  console.log("http smoke ok");
} finally {
  child.kill();
  await Promise.race([once(child, "exit"), delay(2000)]);
}

async function waitForHealth(portNumber) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const health = await getJson(`http://127.0.0.1:${portNumber}/health`);
      if (health.ok) return;
    } catch {
      await delay(250);
    }
  }
  throw new Error("server did not become healthy");
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `${url} returned ${response.status}`);
  return payload;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

