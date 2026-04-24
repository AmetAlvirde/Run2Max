/**
 * Discovery script — dumps all unique field keys from a .fit file after normalization.
 * Used to determine the exact field names for Run2MaxRecord type definition.
 *
 * Usage: tsx packages/engine/src/discover-fields.ts ./fixture-fits/your-run.fit
 */

import { readFile } from "node:fs/promises";
import { parseFitBuffer, normalizeFFP } from "normalize-fit-file";

const fitPath = process.argv[2];
if (!fitPath) {
  console.error("Usage: tsx packages/engine/src/discover-fields.ts <path-to-fit>");
  process.exit(1);
}

const nodeBuf = await readFile(fitPath);
const arrayBuf = nodeBuf.buffer.slice(
  nodeBuf.byteOffset,
  nodeBuf.byteOffset + nodeBuf.byteLength
) as ArrayBuffer;

const raw = await parseFitBuffer(arrayBuf);
const norm = normalizeFFP(raw);

// Collect all unique keys from all records
const recordKeys = new Set<string>();
for (const record of norm.records) {
  for (const key of Object.keys(record)) {
    recordKeys.add(key);
  }
}

// Also collect lap keys for reference
const lapKeys = new Set<string>();
for (const lap of norm.laps) {
  for (const key of Object.keys(lap)) {
    lapKeys.add(key);
  }
}

const sessionKeys = new Set(Object.keys(norm.session));
const metadataKeys = new Set(Object.keys(norm.metadata));

console.log("\n=== RECORD FIELDS ===");
for (const key of [...recordKeys].sort()) {
  const sample = norm.records.find(r => r[key] != null)?.[key];
  console.log(`  ${key}: ${typeof sample} (sample: ${JSON.stringify(sample)})`);
}

console.log(`\n=== LAP FIELDS (${norm.laps.length} laps) ===`);
for (const key of [...lapKeys].sort()) {
  console.log(`  ${key}`);
}

console.log("\n=== SESSION FIELDS ===");
for (const key of [...sessionKeys].sort()) {
  console.log(`  ${key}: ${JSON.stringify(norm.session[key as keyof typeof norm.session])}`);
}

console.log("\n=== METADATA FIELDS ===");
for (const key of [...metadataKeys].sort()) {
  console.log(`  ${key}: ${JSON.stringify(norm.metadata[key as keyof typeof norm.metadata])}`);
}

console.log(`\n=== SUMMARY ===`);
console.log(`  Records: ${norm.records.length}`);
console.log(`  Laps:    ${norm.laps.length}`);
console.log(`  Record field count: ${recordKeys.size}`);
