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
import { quantify } from "./computations/quantify.js";
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

  it.skipIf(!hasFixture)(
    "quantify() produces a valid AnalysisResult",
    async () => {
      const buf = await readFile(fixturePath);
      const ab = nodeBufferToArrayBuffer(buf);

      const config = {
        schemaVersion: 1 as const,
        powerZones: [
          { label: "E", name: "Easy", min: 204, max: 233 },
          { label: "M", name: "Marathon", min: 251, max: 260 },
          { label: "SS", name: "Sweet Spot", min: 260, max: 269 },
          { label: "HM", name: "Half Marathon", min: 269, max: 280 },
          { label: "SUB-T", name: "Sub-Threshold", min: 280, max: 289 },
          { label: "THRESH", name: "Threshold", min: 289, max: 301 },
        ],
        thresholds: { lthr: 171 },
      };

      const result = await quantify(ab, { config });

      // Summary
      expect(result.summary.distance).toBeGreaterThan(0);
      expect(result.summary.duration).toBeGreaterThan(0);
      expect(result.summary.avgPower).toBeGreaterThan(0);
      expect(result.summary.avgPowerZone).toBeTruthy();

      // Segments
      expect(result.segments.length).toBeGreaterThan(0);

      // Km splits
      expect(result.kmSplits.length).toBeGreaterThan(0);
      expect(result.kmSplits[0].km).toBe(1);

      // Zone distribution
      expect(result.zoneDistribution.length).toBeGreaterThanOrEqual(6);
      const totalPct = result.zoneDistribution.reduce(
        (sum, z) => sum + z.percentage,
        0,
      );
      expect(totalPct).toBeCloseTo(100);

      // Dynamics (Stryd file should have dynamics)
      expect(result.dynamicsSummary).not.toBeNull();
      expect(result.dynamicsSummary!.avgFormPowerRatio).toBeGreaterThan(0);

      // Capabilities
      expect(result.capabilities.hasRunningDynamics).toBe(true);
      expect(result.capabilities.hasStrydEnhanced).toBe(true);
    },
  );
});
