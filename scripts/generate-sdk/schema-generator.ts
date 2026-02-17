import {
  quicktype,
  InputData,
  jsonInputForTargetLanguage,
} from 'quicktype-core';
import { camelCase } from 'change-case';

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
          properties[camelCase(property)] = properties[property];
          delete properties[property];
        }
      }
    }

    const requiredProperties = schema.definitions[key].required as
      | string[]
      | undefined;
    if (requiredProperties) {
      for (const [index, requiredProperty] of requiredProperties.entries()) {
        requiredProperties[index] = camelCase(requiredProperty);
      }
    }
  }
}

function replaceRefPaths(
  obj: unknown,
  replacements: Map<string, string>,
): void {
  if (typeof obj !== 'object' || obj === null) return;

  if (Array.isArray(obj)) {
    for (const item of obj) {
      replaceRefPaths(item, replacements);
    }
    return;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key === '$ref' && typeof record[key] === 'string') {
      const replacement = replacements.get(record[key] as string);
      if (replacement) {
        record[key] = replacement;
      }
    } else {
      replaceRefPaths(record[key], replacements);
    }
  }
}

function cleanDefinitionNames(schema: {
  definitions: Record<string, Record<string, unknown>>;
}): Record<string, unknown> {
  // Process in two passes: Element first, then Class.
  // When both resolve to the same base name (e.g. PromoListItemElement and
  // PromoListItemClass both → PromoListItem), the Class pass overwrites the
  // Element result. This is correct because Class definitions are the actual
  // object types while Element definitions are array/union wrappers.
  for (const suffix of ['Element', 'Class']) {
    const refReplacements = new Map<string, string>();

    for (const key of Object.keys(schema.definitions)) {
      if (!key.endsWith(suffix)) continue;

      const newKey = key.slice(0, -suffix.length);
      schema.definitions[newKey] = schema.definitions[key];
      (schema.definitions[newKey] as Record<string, unknown>).title = newKey;
      delete schema.definitions[key];
      refReplacements.set(`#/definitions/${key}`, `#/definitions/${newKey}`);
    }

    replaceRefPaths(schema, refReplacements);
  }

  return schema as Record<string, unknown>;
}

/**
 * Generate a JSON schema from multiple sample JSON strings using quicktype.
 * Converts snake_case keys to camelCase and cleans quicktype disambiguation suffixes from type names.
 */
export async function generateJsonSchema(
  typeName: string,
  jsonSamples: string[],
): Promise<Record<string, unknown>> {
  const { lines } = await quickTypeJsonSchema(typeName, jsonSamples);

  let schema = JSON.parse(lines.join('\n'));

  convertPropertiesToCamelCase(schema);
  schema = cleanDefinitionNames(schema);

  return schema;
}
