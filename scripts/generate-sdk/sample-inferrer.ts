import { camelCase, pascalCase } from 'change-case';
import { isObject } from '../../src/utils/is-object.js';
import { addUniqueType, buildUnion } from './type-utils.js';
import { detectEnums } from './enum-detector.js';
import type {
  InferredType,
  PropertyInfo,
  TypeDefinition,
  EnumDefinition,
  InferredTypeGraph,
} from './types.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2}(\.\d+)?)?$/;

function isDateString(value: string): boolean {
  return DATE_PATTERN.test(value);
}

/**
 * Check whether ALL non-null string values match the date pattern.
 * Returns false if any non-null string does NOT match.
 */
function allStringsAreDates(values: unknown[]): boolean {
  let hasString = false;
  for (const v of values) {
    if (typeof v === 'string') {
      hasString = true;
      if (!isDateString(v)) return false;
    }
  }
  return hasString;
}

/**
 * Determine whether a nested object should be represented as an index
 * signature (`{ [key: string]: null | string }`) rather than a named type.
 *
 * Rule (matches quicktype behaviour): use an index signature when some values
 * are null AND all non-null values are the same primitive type.
 */
function shouldBeIndexSignature(
  allValues: unknown[],
): { isIndex: true; valueType: InferredType } | { isIndex: false } {
  let hasNull = false;
  let nonNullType: string | undefined;

  for (const v of allValues) {
    if (v === null) {
      hasNull = true;
      continue;
    }
    const t = typeof v;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
      return { isIndex: false };
    }
    if (nonNullType === undefined) {
      nonNullType = t;
    } else if (t !== nonNullType) {
      return { isIndex: false };
    }
  }

  if (!hasNull || nonNullType === undefined) return { isIndex: false };

  const primitiveType = nonNullType as 'string' | 'number' | 'boolean';
  return {
    isIndex: true,
    valueType: {
      kind: 'union',
      members: [{ kind: 'null' }, { kind: 'primitive', type: primitiveType }],
    },
  };
}

interface CollectionContext {
  nestedTypes: TypeDefinition[];
  enums: EnumDefinition[];
}

/**
 * Find or create a nested type definition, merging additional samples
 * into an existing definition when one already exists.
 */
function upsertNestedType(
  typeName: string,
  samples: Record<string, unknown>[],
  ctx: CollectionContext,
): void {
  const existing = ctx.nestedTypes.find((t) => t.name === typeName);
  if (existing) {
    mergeIntoNestedType(existing, samples, ctx);
  } else {
    ctx.nestedTypes.push(inferObjectType(typeName, samples, ctx));
  }
}

/**
 * Infer the type of a property from all observed values across samples.
 * For object-typed properties, we need to check ALL samples' values for
 * index-signature detection (not just one at a time).
 */
function inferPropertyType(
  propName: string,
  values: unknown[],
  ctx: CollectionContext,
): InferredType {
  const uniqueTypes: InferredType[] = [];

  // Check if all string values are dates — need to decide once for all values
  const areDates = allStringsAreDates(values);

  // For object-valued properties, collect all objects to check index signature
  // pattern across all samples simultaneously
  const objectValues: Record<string, unknown>[] = [];
  let hasObjectValue = false;

  for (const value of values) {
    if (value === null) {
      addUniqueType(uniqueTypes, { kind: 'null' });
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        addUniqueType(uniqueTypes, {
          kind: 'array',
          elementType: { kind: 'unknown' },
        });
      } else if (isObject(value[0])) {
        const elementTypeName = pascalCase(propName);
        upsertNestedType(
          elementTypeName,
          value as Record<string, unknown>[],
          ctx,
        );
        addUniqueType(uniqueTypes, {
          kind: 'array',
          elementType: { kind: 'object', typeName: elementTypeName },
        });
      } else {
        // Array of primitives
        const elemType =
          areDates && typeof value[0] === 'string'
            ? { kind: 'primitive' as const, type: 'Date' as const }
            : inferSingleValue(value[0]);
        addUniqueType(uniqueTypes, { kind: 'array', elementType: elemType });
      }
    } else if (isObject(value)) {
      hasObjectValue = true;
      objectValues.push(value as Record<string, unknown>);
    } else if (typeof value === 'boolean') {
      addUniqueType(uniqueTypes, { kind: 'primitive', type: 'boolean' });
    } else if (typeof value === 'number') {
      addUniqueType(uniqueTypes, { kind: 'primitive', type: 'number' });
    } else if (typeof value === 'string') {
      if (areDates) {
        addUniqueType(uniqueTypes, { kind: 'primitive', type: 'Date' });
      } else {
        addUniqueType(uniqueTypes, { kind: 'primitive', type: 'string' });
      }
    }
  }

  // Handle collected object values — check index signature across ALL objects
  if (hasObjectValue) {
    const allObjValues: unknown[] = [];
    for (const obj of objectValues) {
      for (const v of Object.values(obj)) {
        allObjValues.push(v);
      }
    }

    const indexCheck = shouldBeIndexSignature(allObjValues);
    if (indexCheck.isIndex) {
      addUniqueType(uniqueTypes, {
        kind: 'indexSignature',
        valueType: indexCheck.valueType,
      });
    } else {
      const nestedTypeName = pascalCase(propName);
      upsertNestedType(nestedTypeName, objectValues, ctx);
      addUniqueType(uniqueTypes, {
        kind: 'object',
        typeName: nestedTypeName,
      });
    }
  }

  return buildUnion(uniqueTypes);
}

function inferSingleValue(value: unknown): InferredType {
  if (value === null) return { kind: 'null' };
  if (typeof value === 'boolean') return { kind: 'primitive', type: 'boolean' };
  if (typeof value === 'number') return { kind: 'primitive', type: 'number' };
  if (typeof value === 'string') {
    return isDateString(value)
      ? { kind: 'primitive', type: 'Date' }
      : { kind: 'primitive', type: 'string' };
  }
  return { kind: 'unknown' };
}

/**
 * Merge additional sample objects into an existing nested TypeDefinition.
 */
function mergeIntoNestedType(
  existing: TypeDefinition,
  samples: Record<string, unknown>[],
  ctx: CollectionContext,
): void {
  for (const sample of samples) {
    for (const [rawKey, value] of Object.entries(sample)) {
      const key = camelCase(rawKey);
      const existingProp = existing.properties.find((p) => p.name === key);
      if (!existingProp) {
        existing.properties.push({
          name: key,
          type: inferPropertyType(key, [value], ctx),
          optional: true,
        });
        existing.properties.sort((a, b) => a.name.localeCompare(b.name));
      }
    }
  }
}

/**
 * Infer a TypeDefinition from an array of sample objects.
 */
function inferObjectType(
  typeName: string,
  samples: Record<string, unknown>[],
  ctx: CollectionContext,
): TypeDefinition {
  // Collect all property names and their values across samples
  const propertyValues = new Map<string, unknown[]>();
  const propertyPresence = new Map<string, number>();

  for (const sample of samples) {
    for (const [rawKey, value] of Object.entries(sample)) {
      const key = camelCase(rawKey);
      const values = propertyValues.get(key) ?? [];
      values.push(value);
      propertyValues.set(key, values);
      propertyPresence.set(key, (propertyPresence.get(key) ?? 0) + 1);
    }
  }

  const properties: PropertyInfo[] = [];

  for (const [name, values] of propertyValues) {
    const presentCount = propertyPresence.get(name) ?? 0;
    const optional = presentCount < samples.length;
    const type = inferPropertyType(name, values, ctx);
    properties.push({ name, type, optional });
  }

  // Sort properties alphabetically
  properties.sort((a, b) => a.name.localeCompare(b.name));

  return { name: typeName, properties };
}

/**
 * Filter flat samples to only include actual objects (not empty arrays
 * or other non-object values that can appear in mixed API responses).
 */
function filterValidSamples(
  flatSamples: Record<string, unknown>[],
): Record<string, unknown>[] {
  return flatSamples.filter((s) => isObject(s) && Object.keys(s).length > 0);
}

/**
 * Infer a complete type graph from sample API responses.
 */
export function inferTypeGraph(
  resourceFolder: string,
  flatSamples: Record<string, unknown>[],
): InferredTypeGraph {
  const typeName = pascalCase(resourceFolder);
  const validSamples = filterValidSamples(flatSamples);

  const ctx: CollectionContext = {
    nestedTypes: [],
    enums: [],
  };

  const rootType = inferObjectType(typeName, validSamples, ctx);

  const graph: InferredTypeGraph = {
    rootType,
    nestedTypes: ctx.nestedTypes,
    enums: ctx.enums,
  };

  // Detect enums in list resources
  if (resourceFolder.includes('list')) {
    detectEnums(graph, validSamples);
  }

  return graph;
}
