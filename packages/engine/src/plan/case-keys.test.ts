import { describe, it, expect } from "vitest";
import {
  transformKeysCamelToSnake,
  transformKeysSnakeToCamel,
} from "./case-keys.js";

const BASE_DATE = new Date("2026-04-12T08:20:00Z");

describe("transformKeysCamelToSnake", () => {
  it("rewrites camelCase keys to snake_case", () => {
    expect(transformKeysCamelToSnake({ avgPower: 224 })).toEqual({
      avg_power: 224,
    });
  });

  it("serializes a Date to an ISO string rather than {}", () => {
    expect(transformKeysCamelToSnake({ date: BASE_DATE })).toEqual({
      date: BASE_DATE.toISOString(),
    });
  });

  it("serializes Dates nested in objects and arrays", () => {
    expect(
      transformKeysCamelToSnake({ runLog: [{ startedAt: BASE_DATE }] }),
    ).toEqual({ run_log: [{ started_at: BASE_DATE.toISOString() }] });
  });
});

describe("transformKeysSnakeToCamel", () => {
  it("rewrites snake_case keys to camelCase", () => {
    expect(transformKeysSnakeToCamel({ avg_power: 224 })).toEqual({
      avgPower: 224,
    });
  });

  it("preserves a Date instance rather than flattening it to {}", () => {
    const result = transformKeysSnakeToCamel({ date: BASE_DATE }) as {
      date: Date;
    };
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.getTime()).toBe(BASE_DATE.getTime());
  });
});

describe("round trip", () => {
  it("survives snake → camel → snake with the Date intact", () => {
    const source = { started_at: BASE_DATE, avg_power: 224 };
    const out = transformKeysCamelToSnake(transformKeysSnakeToCamel(source));
    expect(out).toEqual({
      started_at: BASE_DATE.toISOString(),
      avg_power: 224,
    });
  });
});
