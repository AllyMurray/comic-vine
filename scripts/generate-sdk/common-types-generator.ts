import { camelCase } from 'change-case';
import { isObject } from '../../src/utils/is-object.js';
import type {
  CommonTypeMapping,
  CommonTypeConversion,
  CommonTypeShape,
  InferredTypeGraph,
  InferredType,
} from './types.js';

const isObjectOrNonEmptyArray = (
  maybeObject: unknown,
): maybeObject is Record<string, unknown> | unknown[] => {
  return (
    isObject(maybeObject) ||
    (Array.isArray(maybeObject) && maybeObject.length > 0)
  );
};

// Types matched against the inferred type graph (exact property set match)
// rather than raw sample JSON (subset match). These appear as nested type
// definitions rather than direct property values in samples.
const GRAPH_MATCHED_TYPES = new Set(['Image', 'Death']);

interface ParsedInterface {
  name: string;
  extends?: string;
  ownProperties: string[];
}

/**
 * Parse common-types.ts source and split interfaces into sample-based
 * and graph-based matching groups. Property lists include inherited
 * properties. Sample-based types are sorted by property count (ascending)
 * so that exact matches are preferred over superset matches.
 */
export function parseCommonTypesSource(source: string): {
  sampleBased: CommonTypeShape[];
  graphBased: CommonTypeShape[];
} {
  const interfaceRegex =
    /export\s+interface\s+(\w+)(?:\s+extends\s+(\w+))?\s*\{([^}]+)\}/g;
  const parsed = new Map<string, ParsedInterface>();

  let match;
  while ((match = interfaceRegex.exec(source)) !== null) {
    const [, name, extendsClause, body] = match;
    const propRegex = /^\s*(\w+)\s*[?]?\s*:/gm;
    const ownProperties: string[] = [];
    let propMatch;
    while ((propMatch = propRegex.exec(body)) !== null) {
      ownProperties.push(propMatch[1]);
    }
    parsed.set(name, { name, extends: extendsClause, ownProperties });
  }

  function resolveProps(name: string): string[] {
    const iface = parsed.get(name);
    if (!iface) return [];
    const inherited = iface.extends ? resolveProps(iface.extends) : [];
    return [...inherited, ...iface.ownProperties];
  }

  const all = Array.from(parsed.keys()).map((name) => ({
    typeName: name,
    propList: resolveProps(name),
  }));

  return {
    sampleBased: all
      .filter((t) => !GRAPH_MATCHED_TYPES.has(t.typeName))
      .sort((a, b) => a.propList.length - b.propList.length),
    graphBased: all.filter((t) => GRAPH_MATCHED_TYPES.has(t.typeName)),
  };
}

function getCommonTypeConversion(
  key: string,
  maybeObject: unknown,
  sampleTypes: CommonTypeShape[],
): CommonTypeConversion | undefined {
  if (!isObjectOrNonEmptyArray(maybeObject)) {
    return;
  }

  const isCollection = Array.isArray(maybeObject);
  const objectKeys = Object.keys(
    isCollection
      ? (maybeObject[0] as Record<string, unknown>)
      : (maybeObject as Record<string, unknown>),
  );

  for (const item of sampleTypes) {
    if (objectKeys.every((prop) => item.propList.includes(camelCase(prop)))) {
      return {
        property: camelCase(key),
        newType: item.typeName,
        isArray: isCollection,
      };
    }
  }
}

function extractFromSample(
  sample: Record<string, unknown>,
  commonTypesMap: Map<string, CommonTypeConversion[]>,
  resourceFolder: string,
  sampleTypes: CommonTypeShape[],
): void {
  for (const key of Object.keys(sample)) {
    const conversion = getCommonTypeConversion(key, sample[key], sampleTypes);
    if (!conversion) continue;

    const existing = commonTypesMap.get(resourceFolder);
    if (!existing) {
      commonTypesMap.set(resourceFolder, [conversion]);
      continue;
    }

    const isDuplicate = existing.some(
      (c) =>
        c.property === conversion.property && c.newType === conversion.newType,
    );
    if (!isDuplicate) {
      existing.push(conversion);
    }
  }
}

/**
 * Extract common type mappings from sample API responses.
 * Iterates through all samples and identifies properties whose shapes
 * match known common types (ApiResource, SiteResource, Image, etc.).
 */
export function extractCommonTypes(
  samples: Map<string, Record<string, unknown>[]>,
  sampleTypes: CommonTypeShape[],
): CommonTypeMapping[] {
  const commonTypesMap = new Map<string, CommonTypeConversion[]>();

  for (const [resourceFolder, sampleList] of samples) {
    for (const sample of sampleList) {
      extractFromSample(sample, commonTypesMap, resourceFolder, sampleTypes);
    }
  }

  return Array.from(commonTypesMap, ([resource, propertyConversions]) => ({
    resource,
    propertyConversions,
  }));
}

/**
 * Check whether a nested type name is still referenced by any property in
 * the root type or other nested types.
 */
function isTypeReferenced(typeName: string, graph: InferredTypeGraph): boolean {
  function referencesType(type: InferredType): boolean {
    if (type.kind === 'object' && type.typeName === typeName) return true;
    if (type.kind === 'array') return referencesType(type.elementType);
    if (type.kind === 'union') return type.members.some(referencesType);
    return false;
  }

  for (const prop of graph.rootType.properties) {
    if (referencesType(prop.type)) return true;
  }
  for (const nested of graph.nestedTypes) {
    if (nested.name === typeName) continue;
    for (const prop of nested.properties) {
      if (referencesType(prop.type)) return true;
    }
  }
  return false;
}

/**
 * Apply common type replacements to an InferredTypeGraph.
 *
 * 1. Replaces property types whose sample-based conversion matches a common type
 * 2. Replaces nested type definitions that match graph-based common type shapes
 * 3. Removes nested type definitions that were fully replaced
 */
export function applyCommonTypesToGraph(
  graph: InferredTypeGraph,
  allCommonTypes: CommonTypeMapping[],
  resourceFolder: string,
  graphTypes: CommonTypeShape[],
): void {
  const mapping = allCommonTypes.find((ct) => ct.resource === resourceFolder);
  const conversions = mapping?.propertyConversions ?? [];

  // Apply sample-based common type conversions
  for (const conversion of conversions) {
    for (const prop of graph.rootType.properties) {
      if (prop.name !== conversion.property) continue;

      const commonType: InferredType = {
        kind: 'commonType',
        typeName: conversion.newType,
      };

      if (conversion.isArray) {
        prop.type = { kind: 'array', elementType: commonType };
      } else {
        // Preserve nullability
        if (prop.type.kind === 'union') {
          prop.type = {
            kind: 'union',
            members: prop.type.members.map((m) =>
              m.kind === 'object' ? commonType : m,
            ),
          };
        } else {
          prop.type = commonType;
        }
      }
    }
  }

  // Apply graph-based common type matching
  const replacedNestedTypes = new Set<string>();

  for (const config of graphTypes) {
    for (const nested of graph.nestedTypes) {
      const nestedPropNames = nested.properties.map((p) => p.name).sort();
      const configPropNames = [...config.propList].sort();

      if (
        nestedPropNames.length === configPropNames.length &&
        nestedPropNames.every((p, i) => p === configPropNames[i])
      ) {
        // Replace all references to this nested type with the common type
        replaceTypeReferences(graph, nested.name, config.typeName);
        replacedNestedTypes.add(nested.name);
      }
    }
  }

  // Remove all nested types that are no longer referenced anywhere
  graph.nestedTypes = graph.nestedTypes.filter((t) => {
    if (replacedNestedTypes.has(t.name)) return false;
    return isTypeReferenced(t.name, graph);
  });
}

function replaceTypeReferences(
  graph: InferredTypeGraph,
  oldTypeName: string,
  newTypeName: string,
): void {
  const replace = (type: InferredType): InferredType => {
    if (type.kind === 'object' && type.typeName === oldTypeName) {
      return { kind: 'commonType', typeName: newTypeName };
    }
    if (type.kind === 'array') {
      return { kind: 'array', elementType: replace(type.elementType) };
    }
    if (type.kind === 'union') {
      return { kind: 'union', members: type.members.map(replace) };
    }
    return type;
  };

  for (const prop of graph.rootType.properties) {
    prop.type = replace(prop.type);
  }
  for (const nested of graph.nestedTypes) {
    for (const prop of nested.properties) {
      prop.type = replace(prop.type);
    }
  }
}
