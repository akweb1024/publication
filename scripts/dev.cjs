#!/usr/bin/env node
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "0.0.0.0");
  });
}

async function nextAvailablePort(start, maxOffset = 30) {
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const candidate = start + offset;
    // eslint-disable-next-line no-await-in-loop
    const available = await isPortAvailable(candidate);
    if (available) return candidate;
  }
  throw new Error(`No free port found in range ${start}-${start + maxOffset}`);
}

async function main() {
  const preferredApiPort = Number(process.env.API_PORT || 4000);
  const preferredWebPort = Number(process.env.WEB_PORT || 3000);

  const apiPort = await nextAvailablePort(preferredApiPort);
  const webPort = await nextAvailablePort(preferredWebPort);
  const apiBase = `http://localhost:${apiPort}/api/v1`;

  if (apiPort !== preferredApiPort || webPort !== preferredWebPort) {
    // eslint-disable-next-line no-console
    console.log(
      `[dev] Port conflict detected. Using API:${apiPort} (preferred ${preferredApiPort}), WEB:${webPort} (preferred ${preferredWebPort})`
    );
  } else {
    // eslint-disable-next-line no-console
    console.log(`[dev] Using API:${apiPort}, WEB:${webPort}`);
  }
  // eslint-disable-next-line no-console
  console.log(`[dev] NEXT_PUBLIC_API_BASE=${apiBase}`);

  const cmd = [
    "./node_modules/.bin/concurrently -n api,worker,web -c blue,magenta,green",
    `"API_PORT=${apiPort} ./scripts/pnpm.sh --filter @pub/api dev"`,
    `"./scripts/pnpm.sh --filter @pub/worker dev"`,
    `"WEB_PORT=${webPort} NEXT_PUBLIC_API_BASE=${apiBase} ./scripts/pnpm.sh --filter @pub/web dev"`,
  ].join(" ");

  const child = spawn(cmd, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[dev] Failed to start: ${error.message}`);
  process.exit(1);
});
