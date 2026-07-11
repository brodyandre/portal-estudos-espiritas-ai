import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { config } from "dotenv";

const workspaceRoot = process.cwd();
const repositoryEnvPath = resolve(workspaceRoot, "../../.env");

config({ path: repositoryEnvPath });

const cliEntrypoint = resolve(workspaceRoot, "../../node_modules/prisma/build/index.js");
const args = process.argv.slice(2);

const child = spawn(process.execPath, [cliEntrypoint, ...args], {
  cwd: workspaceRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});

