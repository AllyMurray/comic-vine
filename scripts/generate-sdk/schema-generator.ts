import {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} from 'quicktype-core';
import { toCamelCase } from './utils.js';

async function quickTypeJsonSchema(
  typeName: string,
  jsonSamples: string[],
): Promise<{ lines: string[] }> {
  const jsonInput = jsonInputForTargetLanguage('json-schema');

  await jsonInput.addSource({
    name: typeName,
    samples: jsonSamples,
  });

  const inputData = new InputData();
  inputData.addInput(jsonInput);

  return await quicktype({
    inputData,
    lang: 'json-schema',
    rendererOptions: { 'just-types': 'true' },
  });
}

function convertPropertiesToCamelCase(schema: {
  definitions: Record<string, Record<string, unknown>>;
}): void {
  for (const key of Object.keys(schema.definitions)) {
    const properties = schema.definitions[key].properties as
      | Record<string, unknown>
      | undefined;
    if (properties) {
      for (const property of Object.keys(properties)) {
        if (property.includes('_')) {
          properties[toCamelCase(property)] = properties[property];
          delete properties[property];
        }
      }
    }

    const requiredProperties = schema.definitions[key].required as
      | string[]
      | undefined;
    if (requiredProperties) {
      for (const [index, requiredProperty] of requiredProperties.entries()) {
        requiredProperties[index] = toCamelCase(requiredProperty);
      }
    }
  }
}

function removeClassFromInterfaceNames(schema: {
  definitions: Record<string, Record<string, unknown>>;
}): Record<string, unknown> {
  const replaceProps: Array<{ find: string; replace: string }> = [];
  for (const key of Object.keys(schema.definitions)) {
    if (key.includes('Class')) {
      const newKey = key.substring(0, key.indexOf('Class'));
      schema.definitions[newKey] = schema.definitions[key];
      (schema.definitions[newKey] as Record<string, unknown>).title = newKey;

      delete schema.definitions[key];

      replaceProps.push({ find: key, replace: newKey });
    }
  }

  let schemaString = JSON.stringify(schema);
  replaceProps.forEach(
    (x) =>
      (schemaString = schemaString.replaceAll(
        `#/definitions/${x.find}`,
        `#/definitions/${x.replace}`,
      )),
  );

  return JSON.parse(schemaString);
}

/**
 * Generate a JSON schema from multiple sample JSON strings using quicktype.
 * Converts snake_case keys to camelCase and removes "Class" suffix from type names.
 */
export async function generateJsonSchema(
  typeName: string,
  jsonSamples: string[],
): Promise<Record<string, unknown>> {
  const { lines } = await quickTypeJsonSchema(typeName, jsonSamples);

  // Replace all occurrences of 'Element' in the generated JSON string
  const schemaString = lines.join('\n').replaceAll('Element', '');

  let schema = JSON.parse(schemaString);

  convertPropertiesToCamelCase(schema);
  schema = removeClassFromInterfaceNames(schema);

  return schema;
}
