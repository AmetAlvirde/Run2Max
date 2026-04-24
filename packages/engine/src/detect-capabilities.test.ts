import { describe, it, expect } from "vitest";
import { detectCapabilities } from "./detect-capabilities.js";
import type { Run2MaxRecord } from "./types.js";

const tier1Record: Run2MaxRecord = {
  timestamp: new Date(),
  power: 220,
  heartRate: 140,
  cadence: 83,
  speed: 2.5,
  distance: 100,
};

const tier2Record: Run2MaxRecord = {
  ...tier1Record,
  stanceTime: 350,
  stepLength: 850,
  verticalOscillation: 47,
};

const tier3Record: Run2MaxRecord = {
  ...tier2Record,
  formPower: 80,
  airPower: 2,
  legSpringStiffness: 9.5,
};

describe("detectCapabilities", () => {
  it("returns false for both tiers when records array is empty", () => {
    expect(detectCapabilities([])).toEqual({
      hasRunningDynamics: false,
      hasStrydEnhanced: false,
    });
  });

  it("returns false for both tiers when only Tier 1 fields are present", () => {
    expect(detectCapabilities([tier1Record, tier1Record])).toEqual({
      hasRunningDynamics: false,
      hasStrydEnhanced: false,
    });
  });

  it("detects Tier 2 when running dynamics fields are present", () => {
    expect(detectCapabilities([tier1Record, tier2Record])).toEqual({
      hasRunningDynamics: true,
      hasStrydEnhanced: false,
    });
  });

  it("detects both tiers when Stryd fields are present", () => {
    expect(detectCapabilities([tier3Record])).toEqual({
      hasRunningDynamics: true,
      hasStrydEnhanced: true,
    });
  });

  it("detects Tier 3 without Tier 2 when only Stryd fields are present", () => {
    const strydOnlyRecord: Run2MaxRecord = {
      ...tier1Record,
      formPower: 80,
    };
    expect(detectCapabilities([strydOnlyRecord])).toEqual({
      hasRunningDynamics: false,
      hasStrydEnhanced: true,
    });
  });

  it("returns true when only some records have the field", () => {
    expect(detectCapabilities([tier1Record, tier1Record, tier2Record])).toEqual({
      hasRunningDynamics: true,
      hasStrydEnhanced: false,
    });
  });

  it("treats null and undefined values as absent", () => {
    const recordWithNulls: Run2MaxRecord = {
      ...tier1Record,
      stanceTime: undefined,
      formPower: undefined,
    };
    expect(detectCapabilities([recordWithNulls])).toEqual({
      hasRunningDynamics: false,
      hasStrydEnhanced: false,
    });
  });
});
