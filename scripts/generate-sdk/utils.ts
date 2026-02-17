export function isObject(
  maybeObject: unknown,
): maybeObject is Record<string, unknown> {
  return (
    maybeObject === Object(maybeObject) &&
    !Array.isArray(maybeObject) &&
    typeof maybeObject !== 'function'
  );
}
