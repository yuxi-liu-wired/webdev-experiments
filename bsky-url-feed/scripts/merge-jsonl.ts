#!/usr/bin/env bun
// Merge multiple link-filtered JSONL captures into a single deduplicated stream.
// Dedup by (did, rkey). Newer-discovered records win (latter file overrides earlier).
//
// Inputs: list of files (env INPUT_FILES, comma-separated) or defaults below.
// Output: env OUTPUT_FILE or /tmp/firehose-merged.jsonl.

import { createReadStream, statSync } from "fs";

const DEFAULTS = [
  "/tmp/firehose-168h.jsonl",
  "/tmp/firehose-topup.jsonl",
  "/tmp/firehose-live.jsonl",
  "/tmp/firehose-relay.jsonl",
];

const INPUT_FILES = (process.env.INPUT_FILES ?? DEFAULTS.join(",")).split(",").filter((p) => {
  try {
    return statSync(p).size > 0;
  } catch {
    return false;
  }
});
const OUTPUT_FILE = process.env.OUTPUT_FILE ?? "/tmp/firehose-merged.jsonl";

interface Post {
  did: string;
  rkey: string;
  text?: string;
  createdAt?: string;
}

async function main() {
  console.log(`merging ${INPUT_FILES.length} files into ${OUTPUT_FILE}`);
  const writer = Bun.file(OUTPUT_FILE).writer();
  const seen = new Set<string>();
  const startedAt = Date.now();

  let totalRead = 0;
  let totalWritten = 0;

  for (const path of INPUT_FILES) {
    const file = Bun.file(path);
    const sizeMb = (file.size / 1024 / 1024).toFixed(0);
    console.log(`  ${path} (${sizeMb} MB)...`);
    const stream = file.stream();
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let read = 0;
    let written = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let p: Post;
        try {
          p = JSON.parse(line);
        } catch {
          continue;
        }
        read++;
        if (!p.did || !p.rkey) continue;
        const key = `${p.did}:${p.rkey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        writer.write(line + "\n");
        written++;
      }
    }
    totalRead += read;
    totalWritten += written;
    console.log(`    read ${read.toLocaleString()}, wrote ${written.toLocaleString()} new (dedup'd ${(read - written).toLocaleString()})`);
  }
  await writer.end();
  const sec = ((Date.now() - startedAt) / 1000).toFixed(1);
  const outFile = Bun.file(OUTPUT_FILE);
  console.log(`\ndone in ${sec}s. unique posts: ${totalWritten.toLocaleString()}. read ${totalRead.toLocaleString()}, dedup'd ${(totalRead - totalWritten).toLocaleString()}.`);
  console.log(`output: ${OUTPUT_FILE} (${(outFile.size / 1024 / 1024).toFixed(0)} MB)`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
