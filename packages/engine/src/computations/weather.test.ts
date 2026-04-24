import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  weatherCodeToConditions,
  extractGpsCoordinates,
  fetchWeather,
  interpolateWeatherToSplits,
  type HourlyWeatherData,
} from "./weather.js";
import type { Run2MaxRecord, KmSplitRow } from "../types.js";

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHourly(
  hours: number[],
  overrides: {
    temperature?: number[];
    humidity?: number[];
    dewPoint?: number[];
    windSpeed?: number[];
    windDirection?: number[];
    weatherCode?: number[];
  } = {},
): Record<string, unknown> {
  const len = hours.length;
  return {
    time: hours.map((h) => `2026-04-12T${String(h).padStart(2, "0")}:00:00Z`),
    temperature_2m: overrides.temperature ?? Array(len).fill(18),
    relative_humidity_2m: overrides.humidity ?? Array(len).fill(65),
    dew_point_2m: overrides.dewPoint ?? Array(len).fill(10),
    wind_speed_10m: overrides.windSpeed ?? Array(len).fill(12),
    wind_direction_10m: overrides.windDirection ?? Array(len).fill(270),
    weather_code: overrides.weatherCode ?? Array(len).fill(0),
  };
}

function mockOkResponse(hourly: Record<string, unknown>): void {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ hourly, latitude: -33.44, longitude: -70.63 }),
  } as unknown as Response);
}

function makeHourlyData(
  hours: number[],
  temperature?: number[],
  windSpeed?: number[],
): HourlyWeatherData {
  const len = hours.length;
  return {
    times: hours.map((h) => new Date(`2026-04-12T${String(h).padStart(2, "0")}:00:00Z`)),
    temperature: temperature ?? Array(len).fill(18),
    humidity: Array(len).fill(65),
    dewPoint: Array(len).fill(10),
    windSpeed: windSpeed ?? Array(len).fill(12),
    windDirection: Array(len).fill(270),
    weatherCode: Array(len).fill(0),
  };
}

function makeSplit(km: number, duration: number): KmSplitRow {
  return {
    km,
    duration,
    distance: 1000,
    avgPower: null,
    zone: null,
    avgPace: null,
    avgHeartRate: null,
    avgCadence: null,
    avgStanceTime: null,
    avgStanceTimeBalance: null,
    avgStepLength: null,
    avgVerticalOscillation: null,
    formPowerRatio: null,
    verticalRatio: null,
    elevGain: null,
    elevLoss: null,
    avgAirPower: null,
    windSpeed: null,
    windDirection: null,
    temperature: null,
  };
}

function recWithGps(lat: number, lon: number): Run2MaxRecord {
  return { timestamp: new Date(), positionLat: lat, positionLong: lon } as Run2MaxRecord;
}

function recNoGps(): Run2MaxRecord {
  return { timestamp: new Date() } as Run2MaxRecord;
}

// ---------------------------------------------------------------------------
// weatherCodeToConditions
// ---------------------------------------------------------------------------

describe("weatherCodeToConditions", () => {
  it("returns 'Clear sky' for code 0", () => {
    expect(weatherCodeToConditions(0)).toBe("Clear sky");
  });

  it("returns 'Mainly clear' for code 1", () => {
    expect(weatherCodeToConditions(1)).toBe("Mainly clear");
  });

  it("returns 'Fog' for code 45", () => {
    expect(weatherCodeToConditions(45)).toBe("Fog");
  });

  it("returns a rain description for code 61", () => {
    expect(weatherCodeToConditions(61)).toContain("rain");
  });

  it("returns 'Thunderstorm' for code 95", () => {
    expect(weatherCodeToConditions(95)).toBe("Thunderstorm");
  });

  it("returns 'Unknown conditions' for unrecognized code", () => {
    expect(weatherCodeToConditions(999)).toBe("Unknown conditions");
  });
});

// ---------------------------------------------------------------------------
// extractGpsCoordinates
// ---------------------------------------------------------------------------

describe("extractGpsCoordinates", () => {
  it("returns lat/lon from the first record with both position fields", () => {
    const records = [recNoGps(), recWithGps(-33.44, -70.63), recWithGps(-33.50, -70.70)];
    const result = extractGpsCoordinates(records);

    expect(result).toEqual({ lat: -33.44, lon: -70.63 });
  });

  it("returns null when no records have GPS data", () => {
    const records = [recNoGps(), recNoGps()];
    expect(extractGpsCoordinates(records)).toBeNull();
  });

  it("returns null for empty records array", () => {
    expect(extractGpsCoordinates([])).toBeNull();
  });

  it("requires both positionLat and positionLong", () => {
    const partialRecord = { timestamp: new Date(), positionLat: -33.44 } as Run2MaxRecord;
    const records = [partialRecord];
    expect(extractGpsCoordinates(records)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// fetchWeather
// ---------------------------------------------------------------------------

describe("fetchWeather", () => {
  it("returns WeatherSummary and HourlyWeatherData on success", async () => {
    const hourly = makeHourly([8, 9, 10], { weatherCode: [0, 0, 0] });
    mockOkResponse(hourly);

    const date = new Date("2026-04-12T09:00:00Z");
    const result = await fetchWeather(-33.44, -70.63, date);

    expect(result).not.toBeNull();
    expect(result!.summary.temperature).toBe(18);
    expect(result!.summary.conditions).toBe("Clear sky");
    expect(result!.hourlyData.times).toHaveLength(3);
  });

  it("picks the hourly slot nearest to the provided date for summary", async () => {
    const hourly = makeHourly([8, 9, 10], {
      temperature: [15, 22, 18],
    });
    mockOkResponse(hourly);

    // Date at 09:10 — nearest to hour 9
    const date = new Date("2026-04-12T09:10:00Z");
    const result = await fetchWeather(-33.44, -70.63, date);

    expect(result!.summary.temperature).toBe(22);
  });

  it("returns null on network error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    const result = await fetchWeather(-33.44, -70.63, new Date());
    expect(result).toBeNull();
  });

  it("returns null when response status is not ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as unknown as Response);

    const result = await fetchWeather(-33.44, -70.63, new Date());
    expect(result).toBeNull();
  });

  it("returns null when response JSON is malformed (throws on parse)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as unknown as Response);

    const result = await fetchWeather(-33.44, -70.63, new Date());
    expect(result).toBeNull();
  });

  it("returns null when hourly field is missing from response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ latitude: -33.44 }), // no hourly field
    } as unknown as Response);

    const result = await fetchWeather(-33.44, -70.63, new Date());
    expect(result).toBeNull();
  });

  it("returns null when a required hourly sub-field is missing", async () => {
    const hourly = makeHourly([8, 9]);
    delete hourly["wind_speed_10m"]; // required field missing
    mockOkResponse(hourly);

    const result = await fetchWeather(-33.44, -70.63, new Date());
    expect(result).toBeNull();
  });

  it("returns null on AbortError (timeout simulation)", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortError);

    const result = await fetchWeather(-33.44, -70.63, new Date());
    expect(result).toBeNull();
  });

  it("uses the correct URL format", async () => {
    mockOkResponse(makeHourly([8, 9]));

    await fetchWeather(-33.44, -70.63, new Date("2026-04-12T08:00:00Z"));

    const [calledUrl] = mockFetch.mock.calls[0] as [string, ...unknown[]];
    expect(calledUrl).toContain("archive-api.open-meteo.com");
    expect(calledUrl).toContain("latitude=-33.44");
    expect(calledUrl).toContain("longitude=-70.63");
    expect(calledUrl).toContain("start_date=2026-04-12");
    expect(calledUrl).toContain("end_date=2026-04-12");
    expect(calledUrl).toContain("temperature_2m");
    expect(calledUrl).toContain("weather_code");
  });
});

// ---------------------------------------------------------------------------
// interpolateWeatherToSplits
// ---------------------------------------------------------------------------

describe("interpolateWeatherToSplits", () => {
  it("returns empty array for empty splits", () => {
    const hourlyData = makeHourlyData([8]);
    const result = interpolateWeatherToSplits(hourlyData, [], new Date());
    expect(result).toEqual([]);
  });

  it("returns one WeatherPerSplit per km split", () => {
    const hourlyData = makeHourlyData([8, 9]);
    const splits = [makeSplit(1, 600), makeSplit(2, 600), makeSplit(3, 600)];
    const result = interpolateWeatherToSplits(hourlyData, splits, new Date("2026-04-12T08:00:00Z"));

    expect(result).toHaveLength(3);
    expect(result[0]!.km).toBe(1);
    expect(result[1]!.km).toBe(2);
    expect(result[2]!.km).toBe(3);
  });

  it("picks nearest hourly slot for each split midpoint", () => {
    // Hour 8 → temp=15, Hour 9 → temp=20
    const hourlyData = makeHourlyData([8, 9], [15, 20]);
    // Run starts at 08:00, each split is 30 min (1800s)
    // Split 1 midpoint: 08:15 → nearest to 08:00 (15 min away) → temp=15
    // Split 2 midpoint: 08:45 → nearest to 09:00 (15 min away) → temp=20
    const splits = [makeSplit(1, 1800), makeSplit(2, 1800)];
    const startTime = new Date("2026-04-12T08:00:00Z");

    const result = interpolateWeatherToSplits(hourlyData, splits, startTime);

    expect(result[0]!.temperature).toBe(15);
    expect(result[1]!.temperature).toBe(20);
  });

  it("returns WeatherPerSplit with all required fields", () => {
    const hourlyData = makeHourlyData([8]);
    const splits = [makeSplit(1, 600)];
    const result = interpolateWeatherToSplits(hourlyData, splits, new Date("2026-04-12T08:00:00Z"));

    expect(result[0]).toMatchObject({
      km: 1,
      temperature: expect.any(Number),
      humidity: expect.any(Number),
      dewPoint: expect.any(Number),
      windSpeed: expect.any(Number),
      windDirection: expect.any(Number),
    });
  });
});
