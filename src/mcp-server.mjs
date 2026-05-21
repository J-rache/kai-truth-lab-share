#!/usr/bin/env node
import readline from "node:readline";
import { addClaim, addTool, labStatus, listEvaluations, writeSessionNote } from "./lab.mjs";
import { runEvaluation } from "./evaluators.mjs";
import { sourceStatus } from "./source-status.mjs";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    const result = await handle(request);
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: request.id, result })}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: error.message } })}\n`);
  }
});

async function handle(request) {
  const method = request.method;
  const params = request.params ?? {};
  if (method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "codex-truth-lab", version: "0.1.0" },
      capabilities: { tools: {} }
    };
  }
  if (method === "tools/list") {
    return { tools: toolList() };
  }
  if (method === "tools/call") {
    return callTool(params.name, params.arguments ?? {});
  }
  return {};
}

function toolList() {
  return [
    {
      name: "truth_lab.status",
      description: "Read current lab status.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "truth_lab.list_evals",
      description: "List available evaluation gates.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "truth_lab.run_eval",
      description: "Run an evaluation gate and persist evidence.",
      inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } }
    },
    {
      name: "truth_lab.source_status",
      description: "Separate source changes from ignored runtime evidence.",
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "truth_lab.add_claim",
      description: "Add a truth-state claim.",
      inputSchema: { type: "object", required: ["title"], properties: { title: { type: "string" }, body: { type: "string" }, state: { type: "string" }, evidence: { type: "string" } } }
    },
    {
      name: "truth_lab.add_tool",
      description: "Add or update a tool pointer and verification recipe.",
      inputSchema: { type: "object", required: ["id", "name", "path"], properties: { id: { type: "string" }, name: { type: "string" }, path: { type: "string" }, verification: { type: "array", items: { type: "string" } } } }
    },
    {
      name: "truth_lab.write_note",
      description: "Write a session note.",
      inputSchema: { type: "object", required: ["summary"], properties: { summary: { type: "string" }, details: { type: "string" }, evidence: { type: "array", items: { type: "string" } } } }
    }
  ];
}

async function callTool(name, args) {
  const value = await dispatch(name, args);
  return {
    content: [
      {
        type: "text",
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2)
      }
    ]
  };
}

async function dispatch(name, args) {
  if (name === "truth_lab.status") return labStatus();
  if (name === "truth_lab.list_evals") return listEvaluations();
  if (name === "truth_lab.run_eval") return runEvaluation(args.id);
  if (name === "truth_lab.source_status") return sourceStatus();
  if (name === "truth_lab.add_claim") return addClaim(args);
  if (name === "truth_lab.add_tool") return addTool(args);
  if (name === "truth_lab.write_note") return writeSessionNote(args);
  throw new Error(`Unknown tool: ${name}`);
}

