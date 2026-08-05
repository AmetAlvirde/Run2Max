const snakeToCamelKey = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const camelToSnakeKey = (str: string): string =>
  str.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);

export const transformKeysSnakeToCamel = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(transformKeysSnakeToCamel);
  // Defensive: no current caller can supply a Date (every one passes
  // yaml.parse() output, and yaml v2's core schema resolves timestamps to
  // strings). A Date is an object with no own enumerable keys, so it would be
  // rewritten to {}; preserve the instance if one ever arrives.
  if (value instanceof Date) return value;
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
  // Serialize before the object branch, which would otherwise emit {} —
  // this is what produced `summary.date: {}` in generated YAML.
  if (value instanceof Date) return value.toISOString();
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
