import { toCamelCase } from './utils.js';
import type { CommonTypeMapping, CommonTypeConversion } from './types.js';

const isObjectOrNonEmptyArray = (
  maybeObject: unknown,
): maybeObject is Record<string, unknown> | unknown[] => {
  const isObj =
    typeof maybeObject === 'object' &&
    !Array.isArray(maybeObject) &&
    maybeObject !== null;
  const isNonEmptyArray = Array.isArray(maybeObject) && maybeObject.length > 0;
  return isObj || isNonEmptyArray;
};

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
    if (objectKeys.every((prop) => item.propList.includes(toCamelCase(prop)))) {
      return {
        property: toCamelCase(key),
        newType: item.typeName,
        isArray: isCollection,
      };
    }
  }
}

function extractFromSample(
  sample: Record<string, unknown>,
  commonTypes: CommonTypeMapping[],
  resourceFolder: string,
): void {
  for (const key of Object.keys(sample)) {
    const propertyConversion = getCommonTypeConversion(key, sample[key]);
    if (propertyConversion) {
      const findResourceIndex = commonTypes.findIndex(
        (x) => x.resource === resourceFolder,
      );

      if (findResourceIndex >= 0) {
        const conversionNotInList = !commonTypes[
          findResourceIndex
        ].propertyConversions.some(
          (x) =>
            x.property === propertyConversion.property &&
            x.newType === propertyConversion.newType,
        );
        if (conversionNotInList) {
          commonTypes[findResourceIndex].propertyConversions.push(
            propertyConversion,
          );
        }
      } else {
        commonTypes.push({
          resource: resourceFolder,
          propertyConversions: [propertyConversion],
        });
      }
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
  const commonTypes: CommonTypeMapping[] = [];

  for (const [resourceFolder, sampleList] of samples) {
    for (const sample of sampleList) {
      if (Array.isArray(sample)) {
        for (const item of sample as unknown as Record<string, unknown>[]) {
          extractFromSample(item, commonTypes, resourceFolder);
        }
      } else {
        extractFromSample(sample, commonTypes, resourceFolder);
      }
    }
  }

  return commonTypes;
}
