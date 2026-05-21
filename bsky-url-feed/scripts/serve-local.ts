#!/usr/bin/env bun
// Local Cloudflare Pages simulator. Serves ./public/ with _headers semantics.
// Used for E2E testing; not for production.

import { readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, normalize } from "path";

const PORT = Number(process.env.PORT ?? 8087);
const ROOT = "./public";

interface HeaderRule {
  pattern: RegExp;
  headers: Record<string, string>;
}

async function loadHeaderRules(): Promise<HeaderRule[]> {
  const file = join(ROOT, "_headers");
  if (!existsSync(file)) return [];
  const text = await readFile(file, "utf-8");
  const rules: HeaderRule[] = [];
  let current: HeaderRule | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!line.startsWith(" ") && !line.startsWith("\t")) {
      if (current) rules.push(current);
      const glob = line.trim();
      const re = new RegExp(
        "^" + glob.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      );
      current = { pattern: re, headers: {} };
    } else if (current) {
      const m = line.trim().match(/^([A-Za-z0-9-]+):\s*(.*)$/);
      if (m) current.headers[m[1]] = m[2];
    }
  }
  if (current) rules.push(current);
  return rules;
}

const rules = await loadHeaderRules();

function headersFor(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rules) if (r.pattern.test(path)) Object.assign(out, r.headers);
  return out;
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    // Prevent path traversal
    const safePath = normalize(path).replace(/^(\.\.[/\\])+/, "");
    const fsPath = join(ROOT, safePath);
    if (!existsSync(fsPath)) {
      return new Response("Not Found", { status: 404 });
    }
    const st = await stat(fsPath);
    if (st.isDirectory()) {
      return new Response("Not Found", { status: 404 });
    }
    const body = await readFile(fsPath);
    return new Response(body, { headers: headersFor(path) });
  },
});

console.log(`Serving ./public/ on http://localhost:${server.port}`);
console.log(`Loaded ${rules.length} _headers rules`);
