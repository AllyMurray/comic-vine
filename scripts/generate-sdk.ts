import fs from 'node:fs';
import path from 'node:path';
import {
  extractCommentsFromHtml,
  applyComments,
} from './generate-sdk/comment-injector.js';
import { inferTypeGraph } from './generate-sdk/sample-inferrer.js';
import { emitTypeScript } from './generate-sdk/type-emitter.js';
import { applyTypeOverrides } from './generate-sdk/type-overrides.js';
import {
  parseCommonTypesSource,
  extractCommonTypes,
  applyCommonTypesToGraph,
} from './generate-sdk/common-types-generator.js';
import { generateResourceClass } from './generate-sdk/resource-generator.js';
import { generateResourceTest } from './generate-sdk/test-generator.js';
import { generateMockData } from './generate-sdk/mock-data-generator.js';
import {
  generateResourceIndex,
  generateTypesIndex,
  generateResourceList,
  generateResourceType,
  generateResourceMap,
} from './generate-sdk/barrel-generator.js';
import { isListResource } from './generate-sdk/types.js';
import { pascalCase, kebabCase, snakeCase } from 'change-case';
import pluralize from 'pluralize';

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
  // VideoCategory and VideoType share the same resource type ID in the
  // Comic Vine API. The generated enum uses an eslint-disable comment
  // to allow the duplicate values.
  VideoCategory: 2320,
  VideoType: 2320,
  Volume: 4050,
};

// Overrides for resources whose API names don't follow the standard
// snakeCase / pluralize(snakeCase) pattern.
const RESOURCE_API_NAME_OVERRIDES: Record<
  string,
  { detailName?: string; listName?: string }
> = {
  Thing: { detailName: 'object', listName: 'objects' },
  Series: { listName: 'series_list' },
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

/** Strip the `-details` or `-list-item` suffix to get the base resource name (e.g. `character`). */
function extractResourceName(folder: string): string {
  return folder.replace(/-(details|list-item)$/, '');
}

/** Strip only the trailing `-item` to get the mock file stem (e.g. `character-details` or `character-list`). */
function extractMockName(folder: string): string {
  return folder.replace(/-item$/, '');
}

function main() {
  // ─── Validate required inputs ──────────────────────────────────────
  const docPath = path.join(SAMPLES_DIR, 'documentation.html');
  if (!fs.existsSync(docPath)) {
    throw new Error(
      `Missing required input: ${docPath}\nRun "pnpm samples:fetch" to download API samples first.`,
    );
  }

  const apiDataDir = path.join(SAMPLES_DIR, 'api-data');
  if (!fs.existsSync(apiDataDir) || fs.readdirSync(apiDataDir).length === 0) {
    throw new Error(
      `Missing or empty required input: ${apiDataDir}\nRun "pnpm samples:fetch" to download API samples first.`,
    );
  }

  // ─── Step 0: Generate code comments from documentation HTML ─────────
  console.log('\n--- Step 0: Generating code comments from documentation ---');
  const htmlContent = fs.readFileSync(docPath, 'utf-8');
  const comments = extractCommentsFromHtml(htmlContent);
  writeJson(path.join(SAMPLES_DIR, 'code-comments', 'comments.json'), comments);
  console.log(`  Extracted comments for ${comments.length} resources`);

  // ─── Read all sample data and flatten results in a single pass ─────
  const sampleDataByResource = new Map<string, Record<string, unknown>[]>();
  const flatSamplesByResource = new Map<string, Record<string, unknown>[]>();
  for (const resourceFolder of fs.readdirSync(apiDataDir)) {
    const resourceFolderPath = path.join(apiDataDir, resourceFolder);
    const sampleFiles = fs.readdirSync(resourceFolderPath);
    const data = sampleFiles.map((file) =>
      readJson<Record<string, unknown>>(path.join(resourceFolderPath, file)),
    );
    sampleDataByResource.set(resourceFolder, data);

    const flatResults: Record<string, unknown>[] = [];
    for (const d of data) {
      const results = d.results;
      if (Array.isArray(results)) {
        flatResults.push(...(results as Record<string, unknown>[]));
      } else {
        flatResults.push(results as Record<string, unknown>);
      }
    }
    flatSamplesByResource.set(resourceFolder, flatResults);
  }
  console.log(`Found ${sampleDataByResource.size} sample data folders`);

  // ─── Parse common-types.ts to derive matching configs ───────────────
  const commonTypesSource = fs.readFileSync(
    path.join(SRC_DIR, 'resources', 'common-types.ts'),
    'utf-8',
  );
  const { sampleBased, graphBased } = parseCommonTypesSource(commonTypesSource);

  // ─── Step 1: Extract common types across all samples ───────────────
  console.log('\n--- Step 1: Extracting common types ---');

  const commonTypes = extractCommonTypes(flatSamplesByResource, sampleBased);
  console.log(`  Found ${commonTypes.length} common type mappings`);

  // ─── Step 2: Generate TypeScript type files ────────────────────────
  console.log('\n--- Step 2: Generating TypeScript types ---');
  const classList: string[] = [];

  for (const [resourceFolder, flatSamples] of flatSamplesByResource) {
    console.log(`  Generating types for ${resourceFolder}`);

    // Infer → apply comments → apply common types → apply overrides → emit
    const graph = inferTypeGraph(resourceFolder, flatSamples);
    applyComments(graph, comments);
    applyCommonTypesToGraph(graph, commonTypes, resourceFolder, graphBased);
    applyTypeOverrides(graph);
    const types = emitTypeScript(graph);

    const resourceName = extractResourceName(resourceFolder);
    const kebabResourceName = kebabCase(resourceName);

    // Write type file
    const typesDir = path.join(
      SRC_DIR,
      'resources',
      kebabResourceName,
      'types',
    );
    writeFile(
      path.join(typesDir, `${kebabCase(resourceFolder)}.ts`),
      types.trim() + '\n',
    );

    // For details resources, also generate resource class, test, and barrel files
    if (!isListResource(resourceFolder)) {
      const pascalName = pascalCase(resourceName);
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

  // ─── Step 3: Generate mock data ────────────────────────────────────
  console.log('\n--- Step 3: Generating mock data ---');
  for (const [resourceFolder, data] of sampleDataByResource) {
    const resourceName = extractMockName(resourceFolder);
    const kebabResourceName = kebabCase(resourceName);

    // Use the first sample file for mock data
    const apiResponse = data[0];

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

  // ─── Step 4: Generate barrel and enum files ────────────────────────
  console.log('\n--- Step 4: Generating barrel files ---');

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

  // resource-map.ts
  const resourceMapEntries = classList.map((name) => {
    const overrides = RESOURCE_API_NAME_OVERRIDES[name];
    const defaultDetail = snakeCase(name);
    const defaultList = pluralize(defaultDetail);
    return {
      enumName: name,
      detailName: overrides?.detailName ?? defaultDetail,
      listName: overrides?.listName ?? defaultList,
    };
  });
  writeFile(
    path.join(SRC_DIR, 'resources', 'resource-map.ts'),
    generateResourceMap(resourceMapEntries),
  );

  console.log(`\nDone! Generated files for ${classList.length} resources:`);
  console.log(classList.map((name) => `  - ${name}`).join('\n'));
}

main();
