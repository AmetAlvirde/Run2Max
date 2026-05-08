const snakeToCamelKey = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const camelToSnakeKey = (str: string): string =>
  str.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);

export const transformKeysSnakeToCamel = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(transformKeysSnakeToCamel);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        snakeToCamelKey(k),
        transformKeysSnakeToCamel(v),
      ]),
    );
  }
  return value;
};

export const transformKeysCamelToSnake = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(transformKeysCamelToSnake);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        camelToSnakeKey(k),
        transformKeysCamelToSnake(v),
      ]),
    );
  }
  return value;
};
