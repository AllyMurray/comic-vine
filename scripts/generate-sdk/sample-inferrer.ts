import { camelCase, pascalCase } from 'change-case';
import { isObject } from '../../src/utils/is-object.js';
import type {
  InferredType,
  PropertyInfo,
  TypeDefinition,
  EnumDefinition,
  InferredTypeGraph,
} from './types.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2}(\.\d+)?)?$/;
const ENUM_MAX_UNIQUE_VALUES = 10;

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

/**
 * Check if two InferredType values are structurally equal.
 */
function typesEqual(a: InferredType, b: InferredType): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'primitive' && b.kind === 'primitive')
    return a.type === b.type;
  if (a.kind === 'literal' && b.kind === 'literal') return a.value === b.value;
  if (a.kind === 'object' && b.kind === 'object')
    return a.typeName === b.typeName;
  if (a.kind === 'enum' && b.kind === 'enum') return a.typeName === b.typeName;
  if (a.kind === 'array' && b.kind === 'array')
    return typesEqual(a.elementType, b.elementType);
  if (a.kind === 'union' && b.kind === 'union') {
    if (a.members.length !== b.members.length) return false;
    return a.members.every((m, i) => typesEqual(m, b.members[i]));
  }
  return a.kind === b.kind;
}

function addUniqueType(types: InferredType[], t: InferredType): void {
  if (!types.some((existing) => typesEqual(existing, t))) {
    types.push(t);
  }
}

/**
 * Build a union type from unique member types, using the canonical ordering:
 * - Named/complex types (Date, objects, enums) come first, null last
 * - Primitive null comes first before primitive types (string, number, etc.)
 */
function buildUnion(members: InferredType[]): InferredType {
  const hasNull = members.some((m) => m.kind === 'null');
  const nonNull = members.filter((m) => m.kind !== 'null');

  // All samples are null — the non-null shape is unknown.
  // Emit `unknown` rather than `null | unknown` (which is redundant in TS).
  if (hasNull && nonNull.length === 0) {
    return { kind: 'unknown' };
  }

  if (members.length === 1) return members[0];
  if (!hasNull) {
    return nonNull.length === 1
      ? nonNull[0]
      : { kind: 'union', members: nonNull };
  }

  const nonNullType = nonNull.length === 1 ? nonNull[0] : undefined;

  // Named/complex types come first: Date | null, Object | null, Enum | null
  if (nonNullType) {
    const isNamedOrComplex =
      (nonNullType.kind === 'primitive' && nonNullType.type === 'Date') ||
      nonNullType.kind === 'object' ||
      nonNullType.kind === 'enum' ||
      nonNullType.kind === 'commonType' ||
      nonNullType.kind === 'literal';

    if (isNamedOrComplex) {
      return { kind: 'union', members: [nonNullType, { kind: 'null' }] };
    }
  }

  // Primitives: null | string, null | number, null | unknown
  const ordered = [{ kind: 'null' as const }, ...nonNull];
  return { kind: 'union', members: ordered };
}

interface CollectionContext {
  nestedTypes: TypeDefinition[];
  enums: EnumDefinition[];
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
        const existingNested = ctx.nestedTypes.find(
          (t) => t.name === elementTypeName,
        );
        if (!existingNested) {
          const nestedDef = inferObjectType(
            elementTypeName,
            value as Record<string, unknown>[],
            ctx,
          );
          ctx.nestedTypes.push(nestedDef);
        } else {
          mergeIntoNestedType(
            existingNested,
            value as Record<string, unknown>[],
            ctx,
          );
        }
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
      const existingNested = ctx.nestedTypes.find(
        (t) => t.name === nestedTypeName,
      );
      if (!existingNested) {
        const nestedDef = inferObjectType(nestedTypeName, objectValues, ctx);
        ctx.nestedTypes.push(nestedDef);
      } else {
        mergeIntoNestedType(existingNested, objectValues, ctx);
      }
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
 * Check if a string value is a valid enum candidate (short, no newlines,
 * no URLs, no HTML, no single quotes that would break enum syntax).
 */
function isValidEnumValue(value: string): boolean {
  if (value.includes('\n')) return false;
  if (value.includes("'")) return false;
  if (value.startsWith('http://') || value.startsWith('https://')) return false;
  if (value.includes('<') && value.includes('>')) return false;
  if (value.length > 100) return false;
  // Exclude pure numeric strings (e.g., years, episode numbers, ratings)
  if (/^\d+(\.\d+)?$/.test(value)) return false;
  return true;
}

/**
 * Detect enum patterns in a list resource and replace string types with enums.
 *
 * Only applies to list resources (100+ samples) where string properties have
 * a bounded set of short, clean values.
 */
function detectEnums(
  graph: InferredTypeGraph,
  flatSamples: Record<string, unknown>[],
): void {
  if (flatSamples.length < 10) return;

  // Collect unique string values per camelCase property name (top-level only)
  const stringValues = new Map<string, Set<string>>();
  const totalNonNull = new Map<string, number>();

  for (const sample of flatSamples) {
    for (const [rawKey, value] of Object.entries(sample)) {
      const key = camelCase(rawKey);
      if (typeof value === 'string') {
        const set = stringValues.get(key) ?? new Set();
        set.add(value);
        stringValues.set(key, set);
        totalNonNull.set(key, (totalNonNull.get(key) ?? 0) + 1);
      }
    }
  }

  // Note: nested object properties are intentionally NOT scanned for enums.
  // Nested types that match common types (Image, Death) get replaced, which
  // would orphan any enums detected from their properties.

  // Build a set of properties already typed as Date (skip for enum detection)
  const dateTypedProps = new Set<string>();
  for (const prop of graph.rootType.properties) {
    if (
      (prop.type.kind === 'primitive' && prop.type.type === 'Date') ||
      (prop.type.kind === 'union' &&
        prop.type.members.some(
          (m) => m.kind === 'primitive' && m.type === 'Date',
        ))
    ) {
      dateTypedProps.add(prop.name);
    }
  }

  // Identify enum candidates
  const enumCandidates = new Map<string, Set<string>>();
  for (const [key, values] of stringValues) {
    if (values.size > ENUM_MAX_UNIQUE_VALUES) continue;
    // All values must be valid enum values
    if (![...values].every(isValidEnumValue)) continue;
    // Skip properties already typed as Date
    if (dateTypedProps.has(key)) continue;
    // The property must have at least some non-null occurrences
    // and the value variety must be much smaller than total occurrences
    const nonNullCount = totalNonNull.get(key) ?? 0;
    if (nonNullCount > 0) {
      // Only enum if unique values are a small fraction of total non-null values
      // This prevents normal string fields with few samples from becoming enums
      if (values.size > nonNullCount * 0.25 && values.size > 3) continue;
    }
    enumCandidates.set(key, values);
  }

  if (enumCandidates.size === 0) return;

  // Group candidates that share overlapping value sets
  const enumGroups: Array<{
    name: string;
    propNames: string[];
    values: Set<string>;
  }> = [];

  const sortedCandidates = [...enumCandidates.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );

  for (const [key, values] of sortedCandidates) {
    let merged = false;
    for (const group of enumGroups) {
      const overlaps = [...values].some((v) => group.values.has(v));
      if (overlaps) {
        for (const v of values) group.values.add(v);
        group.propNames.push(key);
        merged = true;
        break;
      }
    }

    if (!merged) {
      enumGroups.push({
        name: pascalCase(key),
        propNames: [key],
        values,
      });
    }
  }

  // Generate enum definitions and update property types
  for (const group of enumGroups) {
    let updated = false;

    for (const propName of group.propNames) {
      if (updatePropertyToEnum(graph.rootType, propName, group.name))
        updated = true;
    }

    // Only add the enum definition if at least one property was updated
    if (updated) {
      const enumDef = buildEnumDefinition(group.name, group.values);
      graph.enums.push(enumDef);
    }
  }
}

function updatePropertyToEnum(
  typeDef: TypeDefinition,
  propName: string,
  enumName: string,
): boolean {
  let updated = false;
  for (const prop of typeDef.properties) {
    if (prop.name !== propName) continue;

    const enumType: InferredType = { kind: 'enum', typeName: enumName };

    if (prop.type.kind === 'union') {
      const hasString = prop.type.members.some(
        (m) => m.kind === 'primitive' && m.type === 'string',
      );
      if (!hasString) continue;

      const newMembers = prop.type.members.map((m) =>
        m.kind === 'primitive' && m.type === 'string' ? enumType : m,
      );
      // Reorder: enum before null (named types come first)
      prop.type = buildUnion(newMembers);
      updated = true;
    } else if (prop.type.kind === 'primitive' && prop.type.type === 'string') {
      prop.type = enumType;
      updated = true;
    }
  }
  return updated;
}

function buildEnumDefinition(
  name: string,
  values: Set<string>,
): EnumDefinition {
  const sortedValues = [...values].sort();
  const members: EnumDefinition['members'] = [];
  const usedKeys = new Map<string, string>();

  for (const value of sortedValues) {
    let key = pascalCase(value);
    if (key === '') key = 'Empty';

    if (usedKeys.has(key)) {
      // Disambiguate by prefixing with enum name
      key = `${name}${key}`;
    }
    usedKeys.set(key, value);
    members.push({ key, value });
  }

  return { name, members };
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
