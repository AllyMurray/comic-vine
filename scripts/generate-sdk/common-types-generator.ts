import { camelCase } from 'change-case';
import { isObject } from '../../src/utils/is-object.js';
import type { CommonTypeMapping, CommonTypeConversion } from './types.js';

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
