import { readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const dirs = ["src", "scripts", "test", "app"];
const files = [];

for (const dir of dirs) {
  for (const file of await walk(path.join(root, dir))) {
    if (file.endsWith(".mjs") || file.endsWith(".js")) files.push(file);
  }
}

for (const file of files) {
  await execFileAsync("node", ["--check", file], { cwd: root, windowsHide: true });
}

console.log(`syntax ok (${files.length} files)`);

async function walk(dir) {
  const output = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(full)));
    else output.push(full);
  }
  return output;
}
