import { existsSync } from "node:fs";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const dryRun = process.argv.includes("--dry-run");
const targetFlag = process.argv.indexOf("--target");
const target = targetFlag >= 0 ? process.argv[targetFlag + 1] : path.join(process.cwd(), "dist-public", "codex-truth-lab-share");

const include = [
  "app",
  "client-packages",
  "docs",
  "examples",
  "lab-room/docs",
  "lab-room/evals",
  "lab-room/lab-config.json",
  "scripts",
  "src",
  "test",
  ".gitignore",
  "AGENTS.md",
  "README.md",
  "package.json"
];

const excludedPatterns = [
  /lab-room[\\/]runs/,
  /lab-room[\\/]runtime/,
  /lab-room[\\/]session-notes/,
  /lab-room[\\/]claims/,
  /lab-room[\\/]tools/,
  /lab-room[\\/]autonomy/,
  /lab-room[\\/]failure-inbox/,
  /lab-room[\\/]mystro-handoffs/,
  /lab-room[\\/]tool-decisions/,
  /lab-room[\\/]proof-bundles/,
  /lab-room[\\/]redundancy/,
  /lab-room[\\/]next-work/,
  /\.env$/,
  /node_modules/
];

if (dryRun) {
  for (const entry of include) assertPublicPath(entry);
  console.log(`public export dry-run ok (${include.length} entries)`);
  process.exit(0);
}

if (existsSync(path.join(target, ".git"))) {
  for (const entry of await readdir(target)) {
    if (entry === ".git") continue;
    await rm(path.join(target, entry), { recursive: true, force: true });
  }
} else {
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}
for (const entry of include) {
  assertPublicPath(entry);
  await cp(path.join(process.cwd(), entry), path.join(target, entry), { recursive: true });
}

const readme = await readFile(path.join(target, "README.md"), "utf8");
await writeFile(
  path.join(target, "README.md"),
  readme.replace(
    "# Codex Truth Lab",
    "# Codex Truth Lab Community\n\nThis is the public share build exported from the private internal workbench."
  ),
  "utf8"
);
console.log(`public export written: ${target}`);

function assertPublicPath(entry) {
  for (const pattern of excludedPatterns) {
    if (pattern.test(entry)) throw new Error(`refusing private/runtime export path: ${entry}`);
  }
}
