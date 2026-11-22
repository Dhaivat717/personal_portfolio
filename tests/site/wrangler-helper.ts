import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        server.close(() => reject(new Error("Could not allocate port")));
        return;
      }
      const { port } = addr;
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });
}

export interface StartWranglerOptions {
  outDir?: string;
}

export async function startWrangler(
  bindings: Record<string, string>,
  options: StartWranglerOptions = {},
): Promise<{
  baseUrl: string;
  logs: () => string;
  stop: () => Promise<void>;
}> {
  const port = await freePort();
  const inspectorPort = await freePort();
  const stateDir = await mkdtemp(join(tmpdir(), "wrangler-test-"));

  const args = [
    "wrangler",
    "pages",
    "dev",
    options.outDir ?? "dist",
    "--port",
    String(port),
    "--inspector-port",
    String(inspectorPort),
    "--persist-to",
    stateDir,
  ];
  for (const [k, v] of Object.entries(bindings)) {
    args.push("--binding", `${k}=${v}`);
  }

  let output = "";
  const child: ChildProcess = spawn("npx", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", (d) => {
    output += d.toString();
  });
  child.stderr?.on("data", (d) => {
    output += d.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      await rm(stateDir, { recursive: true, force: true });
      throw new Error(`wrangler exited early (${child.exitCode}):\n${output}`);
    }
    try {
      const res = await fetch(baseUrl);
      if (res.ok) break;
    } catch {
      // still starting
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  return {
    baseUrl,
    logs: () => output,
    stop: async () => {
      if (child.exitCode === null) {
        child.kill("SIGTERM");
        await new Promise((r) => setTimeout(r, 300));
        if (child.exitCode === null) child.kill("SIGKILL");
      }
      await rm(stateDir, { recursive: true, force: true });
    },
  };
}
