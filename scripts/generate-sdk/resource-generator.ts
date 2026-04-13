/**
 * Generate the source for a resource class file.
 * Template matches the current pattern in src/resources/character/character.ts.
 */
export function generateResourceClass(pascalName: string): string {
  return `import { BaseResource } from '../base-resource.js';
import { ResourceType } from '../resource-type.js';
import { ${pascalName}Details, ${pascalName}ListItem } from './types/index.js';

export class ${pascalName} extends BaseResource<
  ${pascalName}Details,
  ${pascalName}ListItem
> {
  protected resourceType: ResourceType = ResourceType.${pascalName};
}
`;
}
