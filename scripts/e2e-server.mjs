// Starts the production server for end-to-end tests with a fresh demo dataset.
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3100";
rmSync(path.resolve(process.env.DEMO_DATA_DIR ?? ".data-test"), { recursive: true, force: true });

const next = path.resolve("node_modules", "next", "dist", "bin", "next");
const child = spawn(process.execPath, [next, "start", "-p", port], { stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
