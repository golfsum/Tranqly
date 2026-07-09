import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const command = process.argv[2];
if (!command) {
  console.error("Usage: node scripts/run-next.mjs <dev|build|start> [...args]");
  process.exit(1);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(scriptDir);
const parentDir = dirname(projectDir);
const projectBase = projectDir.slice(parentDir.length + 1);
const actualBase =
  readdirSync(parentDir).find(
    (name) => name.toLowerCase() === projectBase.toLowerCase()
  ) ?? projectBase;
const canonicalProjectDir = join(parentDir, actualBase);
const nextBin = join(
  canonicalProjectDir,
  "node_modules",
  "next",
  "dist",
  "bin",
  "next"
);

const child = spawn(process.execPath, [nextBin, command, ...process.argv.slice(3)], {
  cwd: canonicalProjectDir,
  env: {
    ...process.env,
    INIT_CWD: canonicalProjectDir,
  },
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
