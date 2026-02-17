import fs from 'node:fs';
import path from 'node:path';
import { generateJsonSchema } from './generate-sdk/schema-generator.js';
import {
  extractCommentsFromHtml,
  injectComments,
} from './generate-sdk/comment-injector.js';
import { generateTypeScript } from './generate-sdk/type-generator.js';
import { extractCommonTypes } from './generate-sdk/common-types-generator.js';
import { generateResourceClass } from './generate-sdk/resource-generator.js';
import { generateResourceTest } from './generate-sdk/test-generator.js';
import { generateMockData } from './generate-sdk/mock-data-generator.js';
import {
  generateResourceIndex,
  generateTypesIndex,
  generateResourceList,
  generateResourceType,
} from './generate-sdk/barrel-generator.js';
import { toPascalCase, toKebabCase } from './generate-sdk/utils.js';
import type { CommonTypeMapping } from './generate-sdk/types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SAMPLES_DIR = path.join(ROOT, 'samples');
const SRC_DIR = path.join(ROOT, 'src');

// Resource type ID mapping (matches the existing ResourceType enum)
const RESOURCE_TYPE_IDS: Record<string, number> = {
  Character: 4005,
  Concept: 4015,
  Episode: 4070,
  Issue: 4000,
  Location: 4020,
  Movie: 4025,
  Origin: 4030,
  Person: 4040,
  Power: 4035,
  Promo: 1700,
  Publisher: 4010,
  Series: 4075,
  StoryArc: 4045,
  Team: 4060,
  Thing: 4055,
  Video: 2300,
  VideoCategory: 2320,
  VideoType: 2320,
  Volume: 4050,
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
}

function writeJson(filePath: string, data: unknown): void {
  writeFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function main() {
  // ─── Step 0: Generate code comments from documentation HTML ─────────
  console.log('\n--- Step 0: Generating code comments from documentation ---');
  const htmlContent = fs.readFileSync(
    path.join(SAMPLES_DIR, 'documentation.html'),
    'utf-8',
  );
  const comments = extractCommentsFromHtml(htmlContent);
  writeJson(path.join(SAMPLES_DIR, 'code-comments', 'comments.json'), comments);
  console.log(`  Extracted comments for ${comments.length} resources`);

  const apiDataDir = path.join(SAMPLES_DIR, 'api-data');

  // Validate all sample data exists
  const resourceFolders = fs.readdirSync(apiDataDir);
  console.log(`Found ${resourceFolders.length} sample data folders`);

  // ─── Step 1: Generate JSON schemas from sample data ────────────────
  console.log('\n--- Step 1: Generating JSON schemas ---');
  const schemas = new Map<string, Record<string, unknown>>();

  for (const resourceFolder of resourceFolders) {
    const resourceFolderPath = path.join(apiDataDir, resourceFolder);
    const sampleFiles = fs.readdirSync(resourceFolderPath);

    const jsonSamples = sampleFiles.map((file) => {
      const data = readJson<Record<string, unknown>>(
        path.join(resourceFolderPath, file),
      );
      return JSON.stringify(data.results);
    });

    console.log(`  Generating schema for ${resourceFolder}`);
    const schema = await generateJsonSchema(resourceFolder, jsonSamples);

    // Inject property descriptions from comments
    injectComments(schema, comments);

    schemas.set(resourceFolder, schema);
  }

  // ─── Step 2: Extract common types across all schemas ───────────────
  console.log('\n--- Step 2: Extracting common types ---');
  const samples = new Map<string, Record<string, unknown>[]>();
  for (const resourceFolder of resourceFolders) {
    const resourceFolderPath = path.join(apiDataDir, resourceFolder);
    const sampleFiles = fs.readdirSync(resourceFolderPath);

    const sampleResults = sampleFiles.map((file) => {
      const data = readJson<Record<string, unknown>>(
        path.join(resourceFolderPath, file),
      );
      return data.results as Record<string, unknown>;
    });
    samples.set(resourceFolder, sampleResults);
  }

  const commonTypes: CommonTypeMapping[] = extractCommonTypes(samples);
  console.log(`  Found ${commonTypes.length} common type mappings`);

  // ─── Step 3: Generate TypeScript type files ────────────────────────
  console.log('\n--- Step 3: Generating TypeScript types ---');
  const resourceFoldersGenerated: string[] = [];
  const classList: string[] = [];

  for (const resourceFolder of resourceFolders) {
    const schema = schemas.get(resourceFolder)!;
    const typeName = resourceFolder;

    console.log(`  Generating types for ${typeName}`);
    const types = await generateTypeScript(schema, typeName, commonTypes);

    const resourceName = typeName.split(
      typeName.includes('details') ? '-details' : '-list',
    )[0];
    const kebabResourceName = toKebabCase(resourceName);

    // Create resource directory if needed
    const shouldCreateResourceFolder =
      !resourceFoldersGenerated.includes(resourceName);
    if (shouldCreateResourceFolder) {
      resourceFoldersGenerated.push(resourceName);
    }

    // Write type file
    const typesDir = path.join(
      SRC_DIR,
      'resources',
      kebabResourceName,
      'types',
    );
    writeFile(
      path.join(typesDir, `${toKebabCase(typeName)}.ts`),
      types.trim() + '\n',
    );

    // For details resources, also generate resource class, test, and barrel files
    if (!typeName.includes('list')) {
      const pascalName = toPascalCase(resourceName);
      classList.push(pascalName);

      // Resource class
      writeFile(
        path.join(
          SRC_DIR,
          'resources',
          kebabResourceName,
          `${kebabResourceName}.ts`,
        ),
        generateResourceClass(pascalName),
      );

      // Resource test
      writeFile(
        path.join(
          SRC_DIR,
          'resources',
          kebabResourceName,
          `${kebabResourceName}.test.ts`,
        ),
        generateResourceTest(pascalName, kebabResourceName),
      );

      // Resource index barrel
      writeFile(
        path.join(SRC_DIR, 'resources', kebabResourceName, 'index.ts'),
        generateResourceIndex(kebabResourceName),
      );

      // Types index barrel
      writeFile(
        path.join(SRC_DIR, 'resources', kebabResourceName, 'types', 'index.ts'),
        generateTypesIndex(kebabResourceName),
      );
    }
  }

  // ─── Step 4: Generate mock data ────────────────────────────────────
  console.log('\n--- Step 4: Generating mock data ---');
  for (const resourceFolder of resourceFolders) {
    const resourceFolderPath = path.join(apiDataDir, resourceFolder);
    const sampleFiles = fs.readdirSync(resourceFolderPath);
    const resourceName = resourceFolder.replace('-item', '');
    const kebabResourceName = toKebabCase(resourceName);

    // Use the first sample file for mock data
    const apiResponse = readJson<Record<string, unknown>>(
      path.join(resourceFolderPath, sampleFiles[0]),
    );

    console.log(`  Generating mock data for ${kebabResourceName}`);
    const mockOutput = generateMockData(resourceFolder, apiResponse);

    // Write API response mock
    writeJson(
      path.join(
        SRC_DIR,
        '__mocks__',
        'api-response',
        `${kebabResourceName}.json`,
      ),
      mockOutput.apiResponse,
    );

    // Write expected response mock
    writeJson(
      path.join(
        SRC_DIR,
        '__mocks__',
        'expected-responses',
        `${kebabResourceName}.json`,
      ),
      mockOutput.expectedResponse,
    );

    // Write paginated mock data if present
    if (mockOutput.paginatedData) {
      for (const pageData of mockOutput.paginatedData) {
        writeJson(
          path.join(
            SRC_DIR,
            '__mocks__',
            'api-response',
            `${kebabResourceName}-auto-pagination-${pageData.fileSuffix}.json`,
          ),
          pageData.apiResponse,
        );
        writeJson(
          path.join(
            SRC_DIR,
            '__mocks__',
            'expected-responses',
            `${kebabResourceName}-auto-pagination-${pageData.fileSuffix}.json`,
          ),
          pageData.expectedResponse,
        );
      }
    }
  }

  // ─── Step 5: Generate barrel and enum files ────────────────────────
  console.log('\n--- Step 5: Generating barrel files ---');

  // Sort resources alphabetically by PascalCase name for consistent ordering
  classList.sort();

  // resource-list.ts
  writeFile(
    path.join(SRC_DIR, 'resources', 'resource-list.ts'),
    generateResourceList(classList),
  );

  // resource-type.ts
  const resourceTypeMap = new Map<string, number>();
  for (const name of classList) {
    const id = RESOURCE_TYPE_IDS[name];
    if (id !== undefined) {
      resourceTypeMap.set(name, id);
    } else {
      console.warn(`  Warning: No resource type ID found for ${name}`);
    }
  }
  writeFile(
    path.join(SRC_DIR, 'resources', 'resource-type.ts'),
    generateResourceType(resourceTypeMap),
  );

  console.log(`\nDone! Generated files for ${classList.length} resources:`);
  console.log(classList.map((name) => `  - ${name}`).join('\n'));
}

main().catch((error) => {
  console.error('Failed to generate SDK:', error);
  process.exit(1);
});
