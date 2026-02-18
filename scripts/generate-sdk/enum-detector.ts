import { camelCase, pascalCase } from 'change-case';
import { buildUnion } from './type-utils.js';
import type {
  InferredType,
  TypeDefinition,
  EnumDefinition,
  InferredTypeGraph,
} from './types.js';

const ENUM_MAX_UNIQUE_VALUES = 10;

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
export function detectEnums(
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
      // Enum if: unique values <= 25% of total occurrences, OR at most 3 unique
      // values. The 25% ratio prevents free-text fields (high cardinality) from
      // becoming enums. The <=3 escape allows small genuine enums (e.g. "Male",
      // "Female", "Other") even when samples are few.
      if (values.size > nonNullCount * 0.25 && values.size > 3) continue;
    }
    enumCandidates.set(key, values);
  }

  if (enumCandidates.size === 0) return;

  // Group candidates that share identical value sets
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
      // Only merge when value sets are identical — overlapping values
      // across semantically different properties (e.g. crew vs hosts)
      // should not be combined into one enum.
      const identical =
        values.size === group.values.size &&
        [...values].every((v) => group.values.has(v));
      if (identical) {
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
