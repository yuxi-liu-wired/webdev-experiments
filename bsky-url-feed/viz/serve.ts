#!/usr/bin/env bun
// Serve the viz dashboard + compact data file.

import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";

const PORT = Number(process.env.PORT ?? 8088);
const VIZ_DIR = new URL(".", import.meta.url).pathname;
const DATA_FILE = "/tmp/firehose-compact.json";

const server = Bun.serve({
  port: PORT,
  hostname: "::",
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/" || url.pathname === "/index.html") {
      const body = await readFile(join(VIZ_DIR, "index.html"));
      return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/firehose-compact.json") {
      if (!existsSync(DATA_FILE)) return new Response("data not generated yet — run scripts/compact-for-viz.ts", { status: 503 });
      const f = Bun.file(DATA_FILE);
      return new Response(f, { headers: { "Content-Type": "application/json" } });
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`viz on http://localhost:${server.port}`);
