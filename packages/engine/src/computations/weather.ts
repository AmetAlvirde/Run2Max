import type {
  Run2MaxRecord,
  WeatherSummary,
  WeatherPerSplit,
  KmSplitRow,
} from "../types.js";

// ---------------------------------------------------------------------------
// Internal type for parsed hourly weather data (also exported for tests)
// ---------------------------------------------------------------------------

export interface HourlyWeatherData {
  times: Date[];
  temperature: number[];
  humidity: number[];
  dewPoint: number[];
  windSpeed: number[];
  windDirection: number[];
  weatherCode: number[];
}

// ---------------------------------------------------------------------------
// WMO weather code lookup
// ---------------------------------------------------------------------------

const WEATHER_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export function weatherCodeToConditions(code: number): string {
  return WEATHER_CODES[code] ?? "Unknown conditions";
}

// ---------------------------------------------------------------------------
// GPS coordinate extraction
// ---------------------------------------------------------------------------

export function extractGpsCoordinates(
  records: Run2MaxRecord[],
): { lat: number; lon: number } | null {
  for (const record of records) {
    if (record.positionLat != null && record.positionLong != null) {
      return { lat: record.positionLat, lon: record.positionLong };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function findNearestHourIndex(times: Date[], target: Date): number {
  let nearest = 0;
  let minDiff = Math.abs(times[0]!.getTime() - target.getTime());
  for (let i = 1; i < times.length; i++) {
    const diff = Math.abs(times[i]!.getTime() - target.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      nearest = i;
    }
  }
  return nearest;
}

function parseHourlyData(hourly: Record<string, unknown>): HourlyWeatherData | null {
  const times = hourly["time"] as string[] | undefined;
  const temperature = hourly["temperature_2m"] as number[] | undefined;
  const humidity = hourly["relative_humidity_2m"] as number[] | undefined;
  const dewPoint = hourly["dew_point_2m"] as number[] | undefined;
  const windSpeed = hourly["wind_speed_10m"] as number[] | undefined;
  const windDirection = hourly["wind_direction_10m"] as number[] | undefined;
  const weatherCode = hourly["weather_code"] as number[] | undefined;

  if (
    !times || !temperature || !humidity ||
    !dewPoint || !windSpeed || !windDirection || !weatherCode
  ) {
    return null;
  }

  return {
    times: times.map((t) => new Date(t)),
    temperature,
    humidity,
    dewPoint,
    windSpeed,
    windDirection,
    weatherCode,
  };
}

// ---------------------------------------------------------------------------
// Open-Meteo archive API fetch
// ---------------------------------------------------------------------------

export async function fetchWeather(
  lat: number,
  lon: number,
  date: Date,
): Promise<{ summary: WeatherSummary; hourlyData: HourlyWeatherData } | null> {
  const dateStr = formatDate(date);
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: dateStr,
    end_date: dateStr,
    hourly: [
      "temperature_2m",
      "relative_humidity_2m",
      "dew_point_2m",
      "wind_speed_10m",
      "wind_direction_10m",
      "weather_code",
    ].join(","),
  });
  const url = `https://archive-api.open-meteo.com/v1/archive?${params}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!response.ok) return null;

    const json = (await response.json()) as Record<string, unknown>;
    const hourly = json["hourly"] as Record<string, unknown> | undefined;
    if (!hourly) return null;

    const hourlyData = parseHourlyData(hourly);
    if (!hourlyData) return null;

    const nearestIdx = findNearestHourIndex(hourlyData.times, date);

    const summary: WeatherSummary = {
      temperature: hourlyData.temperature[nearestIdx]!,
      humidity: hourlyData.humidity[nearestIdx]!,
      dewPoint: hourlyData.dewPoint[nearestIdx]!,
      windSpeed: hourlyData.windSpeed[nearestIdx]!,
      windDirection: hourlyData.windDirection[nearestIdx]!,
      conditions: weatherCodeToConditions(hourlyData.weatherCode[nearestIdx]!),
    };

    return { summary, hourlyData };
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Interpolate hourly weather data to km splits
// ---------------------------------------------------------------------------

export function interpolateWeatherToSplits(
  hourlyData: HourlyWeatherData,
  kmSplits: KmSplitRow[],
  runStartTime: Date,
): WeatherPerSplit[] {
  let cumulativeDuration = 0;

  return kmSplits.map((split) => {
    const midpointMs =
      runStartTime.getTime() + (cumulativeDuration + split.duration / 2) * 1000;
    cumulativeDuration += split.duration;

    const idx = findNearestHourIndex(hourlyData.times, new Date(midpointMs));

    return {
      km: split.km,
      temperature: hourlyData.temperature[idx]!,
      humidity: hourlyData.humidity[idx]!,
      dewPoint: hourlyData.dewPoint[idx]!,
      windSpeed: hourlyData.windSpeed[idx]!,
      windDirection: hourlyData.windDirection[idx]!,
    };
  });
}
