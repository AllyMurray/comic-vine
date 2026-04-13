import type { InferredType } from './types.js';

/**
 * Check if two InferredType values are structurally equal.
 */
export function typesEqual(a: InferredType, b: InferredType): boolean {
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

export function addUniqueType(types: InferredType[], t: InferredType): void {
  if (!types.some((existing) => typesEqual(existing, t))) {
    types.push(t);
  }
}

/**
 * Build a union type from unique member types, using the canonical ordering:
 * - Named/complex types (Date, objects, enums) come first, null last
 * - Primitive null comes first before primitive types (string, number, etc.)
 */
export function buildUnion(members: InferredType[]): InferredType {
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
