export const isObject = (maybeObject: any) =>
  maybeObject === Object(maybeObject) &&
  !Array.isArray(maybeObject) &&
  typeof maybeObject !== 'function';
