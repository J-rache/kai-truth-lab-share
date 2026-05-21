const state = {
  activeView: "overview"
};

const api = {
  get: (path) => fetch(path).then(check),
  post: (path, body) =>
    fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    }).then(check)
};

function check(response) {
  return response.text().then((text) => {
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error || response.statusText);
    return payload;
  });
}

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

document.querySelectorAll("[data-run-eval]").forEach((button) => {
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await api.post(`/api/evals/${button.dataset.runEval}/run`, {});
      await loadAll();
    } finally {
      button.disabled = false;
    }
  });
});

document.getElementById("refreshSource").addEventListener("click", loadSourceStatus);
document.getElementById("runAutonomy").addEventListener("click", async () => {
  await api.post("/api/autonomy/run", {}).catch((error) => ({ error: error.message }));
  await loadAll();
});
document.getElementById("runMystroHandoff").addEventListener("click", async () => {
  await api.post("/api/mystro/handoff", { projectId: "dashboard", evalId: "completion-gate" }).catch((error) => ({ error: error.message }));
  await Promise.all([loadFailures(), loadRuns()]);
});

document.getElementById("claimForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api.post("/api/claims", {
    title: form.get("title"),
    state: form.get("state"),
    evidence: form.get("evidence") || undefined
  });
  event.currentTarget.reset();
  await loadClaims();
  await loadStatus();
});

document.getElementById("toolForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api.post("/api/tools", {
    id: form.get("id"),
    name: form.get("name"),
    path: form.get("path"),
    verification: form.get("verify") ? [form.get("verify")] : []
  });
  event.currentTarget.reset();
  await loadTools();
  await loadStatus();
});

document.getElementById("promotionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const result = await api.post("/api/tools/promote", {
    id: form.get("id"),
    name: form.get("name"),
    path: form.get("path"),
    verification: [form.get("verify")],
    publicSafe: form.get("publicSafe") === "on"
  });
  document.getElementById("promotionResult").innerHTML = `<article class="item"><h3>${escapeHtml(result.decision)}</h3><small>${escapeHtml(result.reason)}</small></article>`;
});

document.getElementById("seatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api.post("/api/seats/attach", Object.fromEntries(form.entries()));
  event.currentTarget.reset();
  await loadSeats();
  await loadStatus();
});

document.getElementById("noteForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api.post("/api/session-notes", Object.fromEntries(form.entries()));
  event.currentTarget.reset();
  await loadNotes();
});

document.getElementById("failureForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await api.post("/api/failures", Object.fromEntries(form.entries()));
  event.currentTarget.reset();
  await loadFailures();
});

function setView(view) {
  state.activeView = view;
  document.querySelectorAll(".nav").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".view").forEach((panel) => panel.classList.toggle("active", panel.id === `view-${view}`));
}

async function loadAll() {
  await Promise.all([loadStatus(), loadEvals(), loadRuns(), loadSourceStatus(), loadClaims(), loadTools(), loadSeats(), loadFailures(), loadNotes()]);
}

async function loadStatus() {
  const status = await api.get("/api/status");
  document.getElementById("statusLine").textContent = `${status.labName} | claims ${status.claims} | tools ${status.tools} | seats ${status.attachedClients}`;
  document.getElementById("metrics").innerHTML = [
    metric("Claims", status.claims),
    metric("Tools", status.tools),
    metric("Attached", status.attachedClients),
    metric("Runtime paths", status.runtimePaths.length)
  ].join("");
}

async function loadSourceStatus() {
  const status = await api.get("/api/source-status");
  document.getElementById("sourceStatus").textContent = [
    status.branch,
    `source changes: ${status.source.length || "clean"}`,
    `runtime changes: ${status.runtime.length || "clean"}`
  ].join("\n");
}

async function loadEvals() {
  const evals = await api.get("/api/evals");
  document.getElementById("evalList").innerHTML = evals
    .map((item) => `<article class="item"><h3>${escapeHtml(item.name)}</h3><small>${escapeHtml(item.description)}</small><span class="badge">${item.checks} checks</span><button data-run-eval="${escapeHtml(item.id)}">Run</button></article>`)
    .join("");
  document.querySelectorAll("#evalList [data-run-eval]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api.post(`/api/evals/${button.dataset.runEval}/run`, {});
      await loadRuns();
    });
  });
}

async function loadRuns() {
  const runs = await api.get("/api/runs");
  document.getElementById("recentRuns").innerHTML = runs
    .slice()
    .reverse()
    .map((run) => `<article class="item ${run.status === "passed" ? "pass" : "fail"}"><h3>${escapeHtml(run.evaluationName)}</h3><span class="badge ${run.status === "passed" ? "pass" : "fail"}">${run.status}</span><small>${escapeHtml(run.finishedAt)}</small></article>`)
    .join("") || `<article class="item"><small>No runs yet.</small></article>`;
}

async function loadClaims() {
  const claims = await api.get("/api/claims");
  document.getElementById("claimList").innerHTML = claims
    .map((claim) => `<article class="item"><h3>${escapeHtml(claim.title)}</h3><span class="badge">${escapeHtml(claim.state)}</span><small>${escapeHtml((claim.evidence || []).join("; ") || "no evidence")}</small></article>`)
    .join("") || `<article class="item"><small>No claims yet.</small></article>`;
}

async function loadTools() {
  const tools = await api.get("/api/tools");
  document.getElementById("toolList").innerHTML = tools
    .map((tool) => `<article class="item"><h3>${escapeHtml(tool.name)}</h3><small>${escapeHtml(tool.path)}</small><span class="badge">${escapeHtml(tool.id)}</span></article>`)
    .join("") || `<article class="item"><small>No tools yet.</small></article>`;
}

async function loadSeats() {
  const seats = await api.get("/api/seats");
  document.getElementById("seatList").innerHTML = seats
    .map((seat) => `<article class="item"><h3>${escapeHtml(seat.label)}</h3><small>${escapeHtml(seat.model)} | ${escapeHtml(seat.focus || seat.purpose || "")}</small><span class="badge">${escapeHtml(seat.status)}</span></article>`)
    .join("") || `<article class="item"><small>No model seats attached.</small></article>`;
}

async function loadNotes() {
  const notes = await api.get("/api/session-notes");
  document.getElementById("noteList").innerHTML = notes
    .slice()
    .reverse()
    .map((note) => `<article class="item"><h3>${escapeHtml(note.summary)}</h3><small>${escapeHtml(note.timestamp)}</small></article>`)
    .join("") || `<article class="item"><small>No notes yet.</small></article>`;
}

async function loadFailures() {
  const failures = await api.get("/api/failures");
  document.getElementById("failureList").innerHTML = failures
    .slice()
    .reverse()
    .map((failure) => `<article class="item ${failure.severity === "high" ? "fail" : ""}"><h3>${escapeHtml(failure.summary)}</h3><span class="badge">${escapeHtml(failure.severity)}</span><small>${escapeHtml(failure.source)} | ${escapeHtml(failure.status)}</small></article>`)
    .join("") || `<article class="item"><small>No open failures.</small></article>`;
}

function metric(label, value) {
  return `<article class="metric"><span>${label}</span><strong>${value}</strong></article>`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

loadAll().catch((error) => {
  document.getElementById("statusLine").textContent = error.message;
});
