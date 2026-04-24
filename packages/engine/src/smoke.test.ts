/**
 * Smoke tests — require a real .fit file.
 *
 * Run with: FIT_FIXTURE=./fixture-fits/your-run.fit pnpm test
 * Skipped automatically when FIT_FIXTURE is not set.
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFitBuffer, normalizeFFP } from "normalize-fit-file";
import { detectCapabilities } from "./detect-capabilities.js";
import type { Run2MaxRecord } from "./types.js";

// Resolve fixture path relative to the project root so it works regardless
// of which directory vitest is invoked from.
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = resolve(__dirname, "../../../");

const rawFixture = process.env.FIT_FIXTURE?.trim() ?? "";
const fixturePath = rawFixture ? resolve(projectRoot, rawFixture) : "";
const hasFixture = Boolean(fixturePath && existsSync(fixturePath));

function nodeBufferToArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

describe("smoke — real .fit file", () => {
  it.skipIf(!hasFixture)("parses and normalizes without error", async () => {
    const buf = await readFile(fixturePath);
    const raw = await parseFitBuffer(nodeBufferToArrayBuffer(buf));
    const norm = normalizeFFP(raw);

    expect(norm.records.length).toBeGreaterThan(0);
    expect(norm.laps.length).toBeGreaterThan(0);
    expect(norm.metadata).toBeTruthy();
    expect(norm.session).toBeTruthy();
  });

  it.skipIf(!hasFixture)(
    "detectCapabilities returns correct tiers for a Stryd file",
    async () => {
      const buf = await readFile(fixturePath);
      const raw = await parseFitBuffer(nodeBufferToArrayBuffer(buf));
      const norm = normalizeFFP(raw);
      const records = norm.records as Run2MaxRecord[];

      const capabilities = detectCapabilities(records);

      // A Stryd .fit file should have both tiers
      expect(capabilities.hasRunningDynamics).toBe(true);
      expect(capabilities.hasStrydEnhanced).toBe(true);
    },
  );

  it.skipIf(!hasFixture)("Tier 2 fields are present on records", async () => {
    const buf = await readFile(fixturePath);
    const raw = await parseFitBuffer(nodeBufferToArrayBuffer(buf));
    const records = normalizeFFP(raw).records as Run2MaxRecord[];

    const withStanceTime = records.filter((r) => r.stanceTime != null);
    const withStepLength = records.filter((r) => r.stepLength != null);
    const withVerticalOscillation = records.filter(
      (r) => r.verticalOscillation != null,
    );

    expect(withStanceTime.length).toBeGreaterThan(0);
    expect(withStepLength.length).toBeGreaterThan(0);
    expect(withVerticalOscillation.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasFixture)("Tier 3 fields are present on records", async () => {
    const buf = await readFile(fixturePath);
    const raw = await parseFitBuffer(nodeBufferToArrayBuffer(buf));
    const records = normalizeFFP(raw).records as Run2MaxRecord[];

    const withFormPower = records.filter((r) => r.formPower != null);
    const withAirPower = records.filter((r) => r.airPower != null);
    const withLSS = records.filter((r) => r.legSpringStiffness != null);

    expect(withFormPower.length).toBeGreaterThan(0);
    expect(withAirPower.length).toBeGreaterThan(0);
    expect(withLSS.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasFixture)(
    "Tier 1 fields have expected value ranges",
    async () => {
      const buf = await readFile(fixturePath);
      const raw = await parseFitBuffer(nodeBufferToArrayBuffer(buf));
      const records = normalizeFFP(raw).records as Run2MaxRecord[];

      const withPower = records.filter((r) => r.power != null && r.power > 0);
      const withHr = records.filter(
        (r) => r.heartRate != null && r.heartRate > 0,
      );
      const withCadence = records.filter(
        (r) => r.cadence != null && r.cadence > 0,
      );

      expect(withPower.length).toBeGreaterThan(0);
      expect(withHr.length).toBeGreaterThan(0);
      expect(withCadence.length).toBeGreaterThan(0);

      const avgPower =
        withPower.reduce((s, r) => s + (r.power ?? 0), 0) / withPower.length;
      const avgHr =
        withHr.reduce((s, r) => s + (r.heartRate ?? 0), 0) / withHr.length;

      // Sanity-check ranges for a real run
      expect(avgPower).toBeGreaterThan(50);
      expect(avgPower).toBeLessThan(800);
      expect(avgHr).toBeGreaterThan(60);
      expect(avgHr).toBeLessThan(220);
    },
  );
});
