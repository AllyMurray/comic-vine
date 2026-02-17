import { pascalCase, camelCase, kebabCase, snakeCase } from 'change-case';

export function toPascalCase(s: string): string {
  return pascalCase(s);
}

export function toCamelCase(s: string): string {
  return camelCase(s);
}

export function toKebabCase(s: string): string {
  return kebabCase(s);
}

export function toSnakeCase(s: string): string {
  return snakeCase(s);
}

export function isObject(
  maybeObject: unknown,
): maybeObject is Record<string, unknown> {
  return (
    maybeObject === Object(maybeObject) &&
    !Array.isArray(maybeObject) &&
    typeof maybeObject !== 'function'
  );
}
