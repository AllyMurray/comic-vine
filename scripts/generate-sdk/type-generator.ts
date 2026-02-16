import {
  quicktype,
  InputData,
  JSONSchemaInput,
  FetchingJSONSchemaStore,
} from 'quicktype-core';
import { toPascalCase } from './utils.js';
import type { CommonTypeMapping } from './types.js';

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
    (unnecessaryInterface) => unnecessaryInterface !== toPascalCase(typeName),
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
  const indexOfInterface = types.indexOf(`export ${tsType} ${name} `);
  if (indexOfInterface > 0) {
    let startIndex = -1;
    for (let index = indexOfInterface; index >= 0; index--) {
      const character = types[index];
      const previousCharacter = types[index + 1];

      // Failed to find comment
      if (character === '}') {
        startIndex = indexOfInterface;
        break;
      }

      if (character + previousCharacter === '/*') {
        startIndex = index;
        break;
      }
    }
    let endIndex = -1;
    for (let index = indexOfInterface; index <= types.length; index++) {
      const character = types[index];
      if (character === '}') {
        endIndex = index;
        break;
      }
    }
    if (startIndex > 0 && endIndex > 0) {
      types =
        types.substring(0, startIndex - 1) +
        types.substring(endIndex + 1, types.length);
    }
  }
  return types;
}

function replaceCommonTypes(
  allCommonTypes: CommonTypeMapping[],
  typeName: string,
  lines: string[],
): string {
  const commonTypes = allCommonTypes.find(
    (commonType) => commonType.resource === typeName,
  );
  const requiredCommonImports: string[] = [];
  if (commonTypes) {
    for (const commonType of commonTypes.propertyConversions) {
      const findIndex = lines.findIndex(
        (x) =>
          x.includes(`${commonType.property}:`) ||
          x.includes(`${commonType.property}?:`),
      );
      if (findIndex > 0) {
        const whitespace = lines[findIndex].substring(
          0,
          lines[findIndex].indexOf(commonType.property),
        );
        const type = commonType.isArray
          ? `Array<${commonType.newType}>`
          : commonType.newType;
        lines[findIndex] = `${whitespace}${commonType.property}: ${type};`;
      }
    }
    requiredCommonImports.push(
      ...new Set(commonTypes.propertyConversions.map((x) => x.newType)),
    );
  }

  const imageType = lines.find((line) => line.includes('Image')) ? 'Image' : '';
  const deathType = lines.find((line) => line.includes('Death')) ? 'Death' : '';
  lines.unshift(
    `import { ${[...requiredCommonImports, imageType, deathType]
      .filter(Boolean)
      .join(', ')} } from '../../common-types.js';\n`,
  );

  const knownTypes = [
    {
      searchValue: 'hasStaffReview:',
      replaceWith: 'hasStaffReview: null | false | SiteResource;',
    },
    {
      searchValue: 'aliases:',
      replaceWith: 'aliases: null | string;',
    },
  ];

  knownTypes.forEach((type) => {
    const foundIndex = lines.findIndex((line) =>
      line.includes(type.searchValue),
    );
    if (foundIndex) {
      lines[foundIndex] = type.replaceWith;
    }
  });

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
    toPascalCase(typeName),
    JSON.stringify(schema),
  );

  let types = replaceCommonTypes(commonTypes, typeName, lines);
  types = removeUnnecessaryInterfaces(typeName, types);
  types = types.replaceAll('any[]', 'Array<unknown>');
  types = types.replaceAll(': null;', ': null | unknown;');

  return types;
}
