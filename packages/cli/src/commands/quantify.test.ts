import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockLoadConfig,
  mockLoadPlan,
  mockQuantify,
  mockFormatResult,
  mockReadFile,
  mockStat,
  mockWriteFile,
  MockPrescribedRunOverrideError,
} = vi.hoisted(() => {
  class MockPrescribedRunOverrideError extends Error {
    reason: string;
    override: Record<string, string>;
    constructor(reason: string, override: Record<string, string>) {
      super(`Prescribed run override failed: ${reason}`);
      this.name = "PrescribedRunOverrideError";
      this.reason = reason;
      this.override = override;
    }
  }

  return {
    mockLoadConfig: vi.fn(),
    mockLoadPlan: vi.fn(),
    mockQuantify: vi.fn(),
    mockFormatResult: vi.fn(),
    mockReadFile: vi.fn(),
    mockStat: vi.fn(),
    mockWriteFile: vi.fn(),
    MockPrescribedRunOverrideError,
  };
});

vi.mock("@run2max/engine", () => ({
  loadConfig: mockLoadConfig,
  loadPlan: mockLoadPlan,
  quantify: mockQuantify,
  formatResult: mockFormatResult,
  DEFAULT_PROFILE: { sections: [], columns: [] },
  scanBlockRuns: vi.fn().mockResolvedValue([]),
  detectWeekDeviations: vi.fn(),
  reportHasAnomalies: vi.fn().mockReturnValue(false),
  walkPlan: vi.fn().mockReturnValue([]),
  addDays: vi.fn().mockReturnValue("2099-01-08"),
  PrescribedRunOverrideError: MockPrescribedRunOverrideError,
}));

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  stat: mockStat,
  writeFile: mockWriteFile,
}));

import command, { parsePrescribedRunOverride } from "./quantify.js";

describe("quantify command prescribed-run override", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockReadFile.mockResolvedValue(Buffer.from([0x00]));
    mockLoadConfig.mockResolvedValue(null);
    mockLoadPlan.mockResolvedValue({ block: "Build" });
    mockQuantify.mockResolvedValue({ planContext: undefined });
    mockFormatResult.mockReturnValue({ output: "ok", warnings: [] });

    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("maps explicit date selector to overrideDate", () => {
    expect(parsePrescribedRunOverride("date:2026-05-12")).toEqual({
      overrideDate: "2026-05-12",
    });
  });

  it("maps bare label selector to overrideLabel", () => {
    expect(parsePrescribedRunOverride("Tuesday Intervals")).toEqual({
      overrideLabel: "Tuesday Intervals",
    });
  });

  it("maps explicit label selector to overrideLabel", () => {
    expect(parsePrescribedRunOverride("label:Tuesday Intervals")).toEqual({
      overrideLabel: "Tuesday Intervals",
    });
  });

  it("keeps label:YYYY-MM-DD as overrideLabel", () => {
    expect(parsePrescribedRunOverride("label:2026-05-12")).toEqual({
      overrideLabel: "2026-05-12",
    });
  });

  it("throws for malformed date: selector", () => {
    expect(() => parsePrescribedRunOverride("date:Tuesday")).toThrow(
      "--prescribed-run date: must use YYYY-MM-DD",
    );
  });

  it("throws for blank selector", () => {
    expect(() => parsePrescribedRunOverride("   ")).toThrow(
      "--prescribed-run cannot be blank",
    );
  });

  it("throws for empty label: selector", () => {
    expect(() => parsePrescribedRunOverride("label:  ")).toThrow(
      "--prescribed-run label: must include a label",
    );
  });

  it("maps bare date selector to overrideDate in quantify options", async () => {
    await command.run?.({
      args: {
        file: "/tmp/run.fit",
        format: "md",
        "exclude-anomalies": false,
        "no-weather": false,
        "prescribed-run": "2026-05-12",
      },
    });

    expect(mockQuantify).toHaveBeenCalledTimes(1);
    expect(mockQuantify.mock.calls[0]?.[1]).toMatchObject({
      prescribedRunOverride: { overrideDate: "2026-05-12" },
    });
  });

  it("passes cwd plan fallback when override is supplied without --plan", async () => {
    await command.run?.({
      args: {
        file: "/tmp/run.fit",
        format: "md",
        "exclude-anomalies": false,
        "no-weather": false,
        "prescribed-run": "Tuesday Intervals",
      },
    });

    expect(mockLoadPlan).toHaveBeenCalledWith(`${process.cwd()}/plan.yaml`);
    expect(mockQuantify.mock.calls[0]?.[1]).toMatchObject({
      prescribedRunOverride: { overrideLabel: "Tuesday Intervals" },
      plan: { block: "Build" },
    });
  });

  it("fails before quantify when override is supplied and cwd plan is missing", async () => {
    mockLoadPlan.mockRejectedValueOnce(new Error("missing"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`EXIT:${code}`);
      }) as never);

    await expect(
      command.run?.({
        args: {
          file: "/tmp/run.fit",
          format: "md",
          "exclude-anomalies": false,
          "no-weather": false,
          "prescribed-run": "Tuesday Intervals",
        },
      }),
    ).rejects.toThrow("EXIT:1");

    expect(mockQuantify).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("No plan.yaml found in the current working directory"),
    );
  });

  it("does not pass prescribedRunOverride when flag is absent", async () => {
    await command.run?.({
      args: {
        file: "/tmp/run.fit",
        format: "md",
        "exclude-anomalies": false,
        "no-weather": false,
      },
    });

    expect(mockQuantify).toHaveBeenCalledTimes(1);
    expect(mockQuantify.mock.calls[0]?.[1]).not.toHaveProperty(
      "prescribedRunOverride",
    );
  });

  it("passes currentFitBasename derived from input file path", async () => {
    await command.run?.({
      args: {
        file: "/tmp/subdir/run-2026-04-12.fit",
        format: "md",
        "exclude-anomalies": false,
        "no-weather": false,
      },
    });

    expect(mockQuantify).toHaveBeenCalledTimes(1);
    expect(mockQuantify.mock.calls[0]?.[1]).toMatchObject({
      fitDirPath: "/tmp/subdir",
      currentFitBasename: "run-2026-04-12",
    });
  });

  it("exits non-zero with reason in message when quantify throws PrescribedRunOverrideError (ambiguous)", async () => {
    mockQuantify.mockRejectedValueOnce(
      new MockPrescribedRunOverrideError("ambiguous", { overrideLabel: "Wednesday Intervals" }),
    );

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(((code?: string | number | null | undefined) => {
        throw new Error(`EXIT:${code}`);
      }) as never);

    await expect(
      command.run?.({
        args: {
          file: "/tmp/run.fit",
          format: "md",
          "exclude-anomalies": false,
          "no-weather": false,
          "prescribed-run": "Wednesday Intervals",
        },
      }),
    ).rejects.toThrow("EXIT:1");

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("ambiguous"),
    );
  });

  it("does not write formatted output after PrescribedRunOverrideError", async () => {
    mockQuantify.mockRejectedValueOnce(
      new MockPrescribedRunOverrideError("no_prescribed_run", { overrideDate: "2026-04-15" }),
    );

    vi.spyOn(process, "exit").mockImplementation(((code?: string | number | null | undefined) => {
      throw new Error(`EXIT:${code}`);
    }) as never);

    await expect(
      command.run?.({
        args: {
          file: "/tmp/run.fit",
          format: "md",
          "exclude-anomalies": false,
          "no-weather": false,
          "prescribed-run": "date:2026-04-15",
        },
      }),
    ).rejects.toThrow("EXIT:1");

    expect(mockFormatResult).not.toHaveBeenCalled();
    expect(process.stdout.write).not.toHaveBeenCalled();
  });
});
