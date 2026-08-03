const snakeToCamelKey = (str: string): string =>
  str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

const camelToSnakeKey = (str: string): string =>
  str.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);

export const transformKeysSnakeToCamel = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(transformKeysSnakeToCamel);
  // A Date is an object with no own enumerable keys: without this guard it
  // would be rewritten to {}. Preserve it on the way in.
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
