import { toParamCase } from './utils.js';

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
        const kebab = toParamCase(name);
        return `export * from './${kebab}/index.js';`;
      })
      .join('\n') + '\n'
  );
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
