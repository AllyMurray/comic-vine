import { isObject } from './is-object';

export const toCamelCase = (str: string): string => {
  return str.replace(/([-_][a-z])/gi, ($1) => {
    return $1.toUpperCase().replace('-', '').replace('_', '');
  });
};

export const toSnakeCase = (str: string) =>
  str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

type CaseConverter = (str: string) => string;

const convertCase = (caseConverter: CaseConverter, object: any): object => {
  if (isObject(object)) {
    const newObject: any = {};

    Object.keys(object).forEach((key) => {
      newObject[caseConverter(key)] = convertCase(caseConverter, object[key]);
    });

    return newObject;
  } else if (Array.isArray(object)) {
    return object.map((arrayElement) =>
      convertCase(caseConverter, arrayElement)
    );
  }

  return object;
};

export const convertSnakeCaseToCamelCase = <ReturnType>(
  object: any
): ReturnType => {
  return convertCase(toCamelCase, object) as any as ReturnType;
};

export const convertCamelCaseToSnakeCase = <ReturnType>(
  object: any
): ReturnType => {
  return convertCase(toSnakeCase, object) as any as ReturnType;
};
