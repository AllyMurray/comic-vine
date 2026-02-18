import { kebabCase } from 'change-case';

/**
 * Generate the resource index barrel file.
 * Exports the resource class from its file.
 */
export function generateResourceIndex(kebabName: string): string {
  return `export * from './${kebabName}.js';\n`;
}

/**
 * Generate the types index barrel file.
 * Exports both details and list-item types.
 */
export function generateTypesIndex(kebabName: string): string {
  return `export * from './${kebabName}-details.js';
export * from './${kebabName}-list-item.js';
`;
}

/**
 * Generate the resource-list barrel file that exports all resource classes.
 */
export function generateResourceList(resourceNames: string[]): string {
  return (
    resourceNames
      .map((name) => {
        const kebab = kebabCase(name);
        return `export * from './${kebab}/index.js';`;
      })
      .join('\n') + '\n'
  );
}

export interface ResourceMapEntry {
  enumName: string;
  detailName: string;
  listName: string;
}

/**
 * Generate the resource-map.ts file with the ResourceType → API name mapping.
 */
export function generateResourceMap(entries: ResourceMapEntry[]): string {
  const mapEntries = entries
    .map(
      (e) =>
        `  [ResourceType.${e.enumName}, { detailName: '${e.detailName}', listName: '${e.listName}' }],`,
    )
    .join('\n');

  return `import { ResourceType } from './resource-type.js';

interface Resource {
  detailName: string;
  listName: string;
}

const resourceMap = new Map<ResourceType, Resource>([
${mapEntries}
]);

export const getResource = (resourceType: ResourceType) => {
  const resource = resourceMap.get(resourceType);
  if (!resource) {
    throw new Error(\`Resource type (\${resourceType}) not found\`);
  }
  return resource;
};
`;
}

/**
 * Generate the ResourceType enum with resource type IDs.
 */
export function generateResourceType(resources: Map<string, number>): string {
  const entries = Array.from(resources.entries())
    .map(([name, id]) => `  ${name} = ${id},`)
    .join('\n');

  return `/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export enum ResourceType {
${entries}
}
`;
}
