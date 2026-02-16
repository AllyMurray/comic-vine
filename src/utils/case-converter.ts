import { isObject } from './is-object.js';

export const toCamelCase = (str: string): string => {
  return str.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
};

export const toSnakeCase = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

type CaseConverter = (str: string) => string;

const convertCase = (
  caseConverter: CaseConverter,
  object: unknown,
): unknown => {
  if (isObject(object)) {
    const newObject: Record<string, unknown> = {};

    Object.keys(object as Record<string, unknown>).forEach((key) => {
      newObject[caseConverter(key)] = convertCase(
        caseConverter,
        (object as Record<string, unknown>)[key],
      );
    });

    return newObject;
  } else if (Array.isArray(object)) {
    return object.map((arrayElement) =>
      convertCase(caseConverter, arrayElement),
    );
  }

  return object;
};

export const convertSnakeCaseToCamelCase = <ReturnType>(
  object: unknown,
): ReturnType => {
  return convertCase(toCamelCase, object) as ReturnType;
};

export const convertCamelCaseToSnakeCase = <ReturnType>(
  object: unknown,
): ReturnType => {
  return convertCase(toSnakeCase, object) as ReturnType;
};
