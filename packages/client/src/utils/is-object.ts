export const isObject = (maybeObject: unknown) =>
  maybeObject === Object(maybeObject) &&
  !Array.isArray(maybeObject) &&
  typeof maybeObject !== 'function';
