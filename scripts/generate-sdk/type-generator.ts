import {
  quicktype,
  InputData,
  JSONSchemaInput,
  FetchingJSONSchemaStore,
} from 'quicktype-core';
import { pascalCase } from 'change-case';
import type { CommonTypeMapping, CommonTypeConversion } from './types.js';

async function quickTypeTs(
  typeName: string,
  jsonString: string,
): Promise<{ lines: string[] }> {
  const schemaInput = new JSONSchemaInput(new FetchingJSONSchemaStore());

  schemaInput.addSource({
    name: typeName,
    schema: jsonString,
  });

  const inputData = new InputData();
  inputData.addInput(schemaInput);

  return await quicktype({
    inputData,
    lang: 'typescript',
    rendererOptions: { 'just-types': 'true' },
  });
}

function removeUnnecessaryInterfaces(typeName: string, types: string): string {
  // Interfaces that quicktype generates inline but are already defined in
  // src/resources/common-types.ts. We remove them to avoid duplicates and
  // instead import the shared definitions.
  const unnecessaryInterfaces = [
    'AssociatedImage',
    'Character',
    'CreatedCharacter',
    'Death',
    'FirstAppearedInIssue',
    'FirstEpisode',
    'FirstIssue',
    'HasStaffReview',
    'Image',
    'LastIssue',
    'Producer',
    'RelatedAPIIssueResource',
    'Series',
    'VideoCategory',
    'Volume',
  ].filter(
    (unnecessaryInterface) => unnecessaryInterface !== pascalCase(typeName),
  );
  const unnecessaryEnums = ['ImageTags'];

  for (const unnecessaryInterface of unnecessaryInterfaces) {
    types = removeType(types, unnecessaryInterface, 'interface');
  }
  for (const unnecessaryEnum of unnecessaryEnums) {
    types = removeType(types, unnecessaryEnum, 'enum');
  }
  return types;
}

function removeType(
  types: string,
  name: string,
  tsType: 'interface' | 'enum',
): string {
  // Match an optional JSDoc comment (/**...*/) followed by the type declaration.
  // The JSDoc content uses (?:[^*]|\*(?!/))* instead of [\s\S]*? to prevent
  // backtracking past the closing */ into subsequent code.
  const pattern = new RegExp(
    `(?:/\\*\\*(?:[^*]|\\*(?!/))*\\*/\\s*)?export ${tsType} ${name} \\{[\\s\\S]*?\\n\\}`,
  );
  return types.replace(pattern, '');
}

function applyCommonTypeReplacements(
  lines: string[],
  conversions: CommonTypeConversion[],
): void {
  for (const conversion of conversions) {
    const index = lines.findIndex(
      (x) =>
        x.includes(`${conversion.property}:`) ||
        x.includes(`${conversion.property}?:`),
    );
    if (index > 0) {
      const whitespace = lines[index].substring(
        0,
        lines[index].indexOf(conversion.property),
      );
      const type = conversion.isArray
        ? `Array<${conversion.newType}>`
        : conversion.newType;
      lines[index] = `${whitespace}${conversion.property}: ${type};`;
    }
  }
}

// quicktype infers incorrect types for these properties from ambiguous sample data:
// - hasStaffReview can be null, false, or a SiteResource object
// - aliases can be null or a newline-delimited string
function applyKnownTypeOverrides(lines: string[]): void {
  const overrides = [
    {
      searchValue: 'hasStaffReview:',
      replaceWith: 'hasStaffReview: null | false | SiteResource;',
    },
    {
      searchValue: 'aliases:',
      replaceWith: 'aliases: null | string;',
    },
  ];

  for (const override of overrides) {
    const index = lines.findIndex((line) =>
      line.includes(override.searchValue),
    );
    if (index !== -1) {
      lines[index] = override.replaceWith;
    }
  }
}

function prependCommonTypeImports(
  lines: string[],
  conversions: CommonTypeConversion[],
): void {
  const imports = new Set<string>(conversions.map((c) => c.newType));
  if (lines.some((line) => line.includes('Image'))) imports.add('Image');
  if (lines.some((line) => line.includes('Death'))) imports.add('Death');
  lines.unshift(
    `import { ${[...imports].join(', ')} } from '../../common-types.js';\n`,
  );
}

function applyCommonTypes(
  allCommonTypes: CommonTypeMapping[],
  typeName: string,
  lines: string[],
): string {
  const mapping = allCommonTypes.find(
    (commonType) => commonType.resource === typeName,
  );
  const conversions = mapping?.propertyConversions ?? [];

  applyCommonTypeReplacements(lines, conversions);
  applyKnownTypeOverrides(lines);
  prependCommonTypeImports(lines, conversions);

  return lines.join('\n');
}

/**
 * Generate TypeScript interfaces from a JSON schema.
 * Replaces inline types with common type imports and removes unnecessary duplicate interfaces.
 */
export async function generateTypeScript(
  schema: Record<string, unknown>,
  typeName: string,
  commonTypes: CommonTypeMapping[],
): Promise<string> {
  const { lines } = await quickTypeTs(
    pascalCase(typeName),
    JSON.stringify(schema),
  );

  let types = applyCommonTypes(commonTypes, typeName, lines);
  types = removeUnnecessaryInterfaces(typeName, types);
  types = types.replaceAll('any[]', 'Array<unknown>');
  types = types.replaceAll(': null;', ': null | unknown;');

  return types;
}
