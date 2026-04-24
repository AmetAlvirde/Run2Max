import { describe, it, expect } from "vitest";
import { detectAnomalies, applyAnomalyExclusions } from "./anomalies.js";
import type { Run2MaxRecord } from "../types.js";

function rec(overrides: Partial<Run2MaxRecord> = {}): Run2MaxRecord {
  return { timestamp: new Date(), heartRate: 140, power: 220, ...overrides };
}

describe("detectAnomalies", () => {
  it("returns empty array for clean data", () => {
    const records = [rec(), rec(), rec()];
    expect(detectAnomalies(records)).toEqual([]);
  });

  it("detects heartRate=0 as a single cluster", () => {
    const records = [
      rec({ heartRate: 0 }),
      rec({ heartRate: 0 }),
      rec({ heartRate: 0 }),
      rec(),
    ];
    const anomalies = detectAnomalies(records);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].type).toBe("zero_value");
    expect(anomalies[0].field).toBe("heartRate");
    expect(anomalies[0].affectedRecords).toBe(3);
    expect(anomalies[0].excluded).toBe(false);
  });

  it("splits non-contiguous HR=0 into separate clusters", () => {
    const records = [
      rec({ heartRate: 0 }),
      rec({ heartRate: 0 }),
      rec(), // gap
      rec({ heartRate: 0 }),
    ];
    const anomalies = detectAnomalies(records);
    expect(anomalies).toHaveLength(2);
    expect(anomalies[0].affectedRecords).toBe(2);
    expect(anomalies[1].affectedRecords).toBe(1);
  });

  it("labels early anomalies as sensor warmup", () => {
    const records = [rec({ heartRate: 0 }), rec()];
    const anomalies = detectAnomalies(records);
    expect(anomalies[0].description).toContain("likely sensor warmup");
  });

  it("labels later anomalies as sensor dropout", () => {
    // Place anomaly beyond the 30-record warmup threshold
    const records = Array.from({ length: 35 }, () => rec());
    records[32] = rec({ heartRate: 0 });
    const anomalies = detectAnomalies(records);
    expect(anomalies[0].description).toContain("sensor dropout");
  });

  it("detects legSpringStiffness=0", () => {
    const records = [rec({ legSpringStiffness: 0 }), rec()];
    const anomalies = detectAnomalies(records);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].field).toBe("legSpringStiffness");
  });

  it("detects multiple anomaly types in same dataset", () => {
    const records = [
      rec({ heartRate: 0, legSpringStiffness: 0 }),
      rec(),
    ];
    const anomalies = detectAnomalies(records);
    expect(anomalies).toHaveLength(2);
    const fields = anomalies.map((a) => a.field).sort();
    expect(fields).toEqual(["heartRate", "legSpringStiffness"]);
  });

  it("ignores null/undefined fields (not anomalous)", () => {
    const records = [rec({ heartRate: undefined }), rec()];
    const anomalies = detectAnomalies(records);
    expect(anomalies).toEqual([]);
  });
});

describe("applyAnomalyExclusions", () => {
  it("nulls only the affected field, leaves others intact", () => {
    const records = [rec({ heartRate: 0, power: 220 })];
    const anomalies = detectAnomalies(records);
    const result = applyAnomalyExclusions(records, anomalies);

    expect(result[0].heartRate).toBeNull();
    expect(result[0].power).toBe(220);
  });

  it("sets excluded=true on all anomalies", () => {
    const records = [rec({ heartRate: 0 }), rec()];
    const anomalies = detectAnomalies(records);
    applyAnomalyExclusions(records, anomalies);

    expect(anomalies.every((a) => a.excluded)).toBe(true);
  });

  it("does not modify records without anomalies", () => {
    const original = rec({ heartRate: 140, power: 250 });
    const records = [original];
    const anomalies = detectAnomalies(records);
    const result = applyAnomalyExclusions(records, anomalies);

    expect(result[0]).toBe(original); // same reference, not copied
  });

  it("handles LSS=0 exclusion", () => {
    const records = [rec({ legSpringStiffness: 0, heartRate: 140 })];
    const anomalies = detectAnomalies(records);
    const result = applyAnomalyExclusions(records, anomalies);

    expect(result[0].legSpringStiffness).toBeNull();
    expect(result[0].heartRate).toBe(140);
  });
});
