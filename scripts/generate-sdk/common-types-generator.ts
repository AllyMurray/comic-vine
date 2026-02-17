import { camelCase } from 'change-case';
import { isObject } from '../../src/utils/is-object.js';
import type {
  CommonTypeMapping,
  CommonTypeConversion,
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

// Each entry matches a shared interface in src/resources/common-types.ts.
// The property lists define the expected shape — when a sample object's keys
// are a subset of a config entry's propList, that property is replaced with
// an import of the shared type.
const commonTypeConfig = [
  {
    typeName: 'AssociatedImage',
    propList: ['caption', 'id', 'imageTags', 'originalUrl'],
  },
  {
    typeName: 'ApiResource',
    propList: ['apiDetailUrl', 'id', 'name'],
  },
  {
    typeName: 'IssueApiResource',
    propList: ['apiDetailUrl', 'id', 'issueNumber', 'name'],
  },
  {
    typeName: 'SiteResource',
    propList: ['apiDetailUrl', 'id', 'name', 'siteDetailUrl'],
  },
  {
    typeName: 'SiteResourceWithCount',
    propList: ['apiDetailUrl', 'id', 'name', 'siteDetailUrl', 'count'],
  },
  {
    typeName: 'IssueSiteResource',
    propList: ['apiDetailUrl', 'id', 'issueNumber', 'name', 'siteDetailUrl'],
  },
  {
    typeName: 'EpisodeApiResource',
    propList: ['apiDetailUrl', 'id', 'name', 'episodeNumber'],
  },
  {
    typeName: 'EpisodeSiteResource',
    propList: ['apiDetailUrl', 'id', 'name', 'siteDetailUrl', 'episodeNumber'],
  },
  {
    typeName: 'PersonCreditSiteResource',
    propList: ['apiDetailUrl', 'id', 'name', 'siteDetailUrl', 'role'],
  },
];

function getCommonTypeConversion(
  key: string,
  maybeObject: unknown,
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

  for (const item of commonTypeConfig) {
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
): void {
  for (const key of Object.keys(sample)) {
    const conversion = getCommonTypeConversion(key, sample[key]);
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
): CommonTypeMapping[] {
  const commonTypesMap = new Map<string, CommonTypeConversion[]>();

  for (const [resourceFolder, sampleList] of samples) {
    for (const sample of sampleList) {
      extractFromSample(sample, commonTypesMap, resourceFolder);
    }
  }

  return Array.from(commonTypesMap, ([resource, propertyConversions]) => ({
    resource,
    propertyConversions,
  }));
}

// Additional common types that are detected by shape matching on the type graph
// rather than by the sample-based extraction above. Image and Death are handled
// here because they were previously matched by quicktype's naming + text search.
const graphCommonTypeConfig = [
  {
    typeName: 'Image',
    propList: [
      'iconUrl',
      'imageTags',
      'mediumUrl',
      'originalUrl',
      'screenLargeUrl',
      'screenUrl',
      'smallUrl',
      'superUrl',
      'thumbUrl',
      'tinyUrl',
    ],
  },
  {
    typeName: 'Death',
    propList: ['date', 'timezone', 'timezoneType'],
  },
];

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
 * 2. Replaces nested type definitions that match Image or Death shapes
 * 3. Removes nested type definitions that were fully replaced
 */
export function applyCommonTypesToGraph(
  graph: InferredTypeGraph,
  allCommonTypes: CommonTypeMapping[],
  resourceFolder: string,
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

  // Apply graph-based common type matching (Image, Death)
  const replacedNestedTypes = new Set<string>();

  for (const config of graphCommonTypeConfig) {
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
