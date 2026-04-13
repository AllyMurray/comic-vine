/**
 * Discovers non-null sample variants for fields currently typed as `unknown`.
 *
 * Run manually:
 *   COMIC_VINE_API_KEY=... tsx scripts/find-unknown-samples.ts
 *
 * Uses the list API to scan up to 100 records per request (vs 1 with detail
 * endpoints). State is persisted to samples/discovery-state.json between runs
 * so subsequent runs resume where the last left off. Delete the file to start
 * fresh.
 *
 * The script does NOT modify any SDK files — add discovered URLs to
 * samples/config.json manually, then run:
 *   pnpm samples:fetch && pnpm sdk:generate && pnpm format
 */

import fs from 'node:fs';
import path from 'node:path';
import { HttpClient } from '@http-client-toolkit/core';
import { InMemoryRateLimitStore } from '@http-client-toolkit/store-memory';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from '../src/http-client/hooks.js';

const BASE_URL = 'https://comicvine.gamespot.com/api/';
const PAGE_SIZE = 100;
const STATE_FILE = path.join(
  path.resolve(import.meta.dirname, '..', 'samples'),
  'discovery-state.json',
);

// ---------------------------------------------------------------------------
// Tee logging
// ---------------------------------------------------------------------------

const LOG_DIR = path.resolve(import.meta.dirname, '..', 'samples');
const logTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
const LOG_FILE = path.join(LOG_DIR, `discovery-${logTimestamp}.log`);
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

function log(...args: unknown[]) {
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  console.log(...args);
  logStream.write(line + '\n');
}

function logError(...args: unknown[]) {
  const line = args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ');
  console.error(...args);
  logStream.write('[ERROR] ' + line + '\n');
}

// ---------------------------------------------------------------------------
// Persistent state
// ---------------------------------------------------------------------------

interface ResourceState {
  resolved: Record<string, { id: number; value: unknown }>;
  /** Next offset for list pagination — resumes across runs */
  nextOffset: number;
  /** Total records scanned so far */
  recordsScanned: number;
  /** Total results reported by the API */
  totalResults?: number;
}

type DiscoveryState = Record<string, ResourceState>;

function loadState(): DiscoveryState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as DiscoveryState;
  }
  return {};
}

function saveState(ds: DiscoveryState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(ds, null, 2));
}

function getResourceState(name: string): ResourceState {
  const defaults: ResourceState = {
    resolved: {},
    nextOffset: 0,
    recordsScanned: 0,
  };
  return { ...defaults, ...state[name] };
}

const state = loadState();

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

const apiKey = process.env.COMIC_VINE_API_KEY;
if (!apiKey) {
  logError('Error: COMIC_VINE_API_KEY environment variable is required');
  process.exit(1);
}

const http = new HttpClient({
  rateLimit: new InMemoryRateLimitStore({
    defaultConfig: { limit: 1, windowMs: 1000 },
  }),
  throwOnRateLimit: false,
  maxWaitTime: 10_000,
  retry: { maxRetries: 3 },
  responseTransformer: comicVineResponseTransformer,
  responseHandler: comicVineResponseHandler,
  errorHandler: comicVineErrorHandler,
});

// ---------------------------------------------------------------------------
// Probe targets
// ---------------------------------------------------------------------------

interface ProbeTarget {
  name: string;
  /** List endpoint path, e.g. "issues" */
  listPath: string;
  /** Detail path prefix for constructing suggested URLs, e.g. "issue/4000" */
  detailPath: string;
  /** snake_case field names for the API field_list param */
  apiFields: string[];
  /** camelCase field names for reading the response */
  responseFields: string[];
  /** Max list requests per run (each returns up to 100 records) */
  maxPages: number;
  /** Sort param, e.g. "id:asc" */
  sort?: string;
}

interface FieldHit {
  id: number;
  value: unknown;
}

interface ProbeResult {
  name: string;
  detailPath: string;
  resolved: Map<string, FieldHit>;
  unresolved: string[];
  pagesUsed: number;
  recordsScanned: number;
  skipped?: string;
}

const PROBE_TARGETS: ProbeTarget[] = [
  {
    name: 'episode',
    listPath: 'episodes',
    detailPath: 'episode/4070',
    apiFields: [
      'first_appearance_characters',
      'first_appearance_concepts',
      'first_appearance_locations',
      'first_appearance_objects',
      'first_appearance_storyarcs',
      'first_appearance_teams',
    ],
    responseFields: [
      'firstAppearanceCharacters',
      'firstAppearanceConcepts',
      'firstAppearanceLocations',
      'firstAppearanceObjects',
      'firstAppearanceStoryarcs',
      'firstAppearanceTeams',
    ],
    maxPages: 50,
    sort: 'id:asc',
  },
  {
    name: 'issue',
    listPath: 'issues',
    detailPath: 'issue/4000',
    apiFields: [
      'first_appearance_characters',
      'first_appearance_concepts',
      'first_appearance_locations',
      'first_appearance_objects',
      'first_appearance_storyarcs',
      'first_appearance_teams',
    ],
    responseFields: [
      'firstAppearanceCharacters',
      'firstAppearanceConcepts',
      'firstAppearanceLocations',
      'firstAppearanceObjects',
      'firstAppearanceStoryarcs',
      'firstAppearanceTeams',
    ],
    maxPages: 50,
    // Oldest issues first — golden/silver age comics have first appearances
    sort: 'id:asc',
  },
  // movie.distributor removed — exhausted all 2,982 movies, always null.
  // origin.character_set removed — handled as a type override.
  // The API has exactly 10 origins (IDs 1-10) and character_set is null on all of them.
  {
    name: 'person',
    listPath: 'people',
    detailPath: 'person/4040',
    apiFields: ['count_of_isssue_appearances', 'death', 'email', 'hometown'],
    responseFields: ['countOfIsssueAppearances', 'death', 'email', 'hometown'],
    maxPages: 50,
    sort: 'id:asc',
  },
  // video.saved_time, video.video_show removed — exhausted all 3,119 videos, always null.
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function previewValue(value: unknown): string {
  const json = JSON.stringify(value);
  return json.length > 120 ? json.slice(0, 120) + '...' : json;
}

// ---------------------------------------------------------------------------
// List-based probing
// ---------------------------------------------------------------------------

interface ListResponse {
  numberOfTotalResults: number;
  numberOfPageResults: number;
  results: Array<Record<string, unknown>>;
}

async function probeResource(target: ProbeTarget): Promise<ProbeResult> {
  log(`\n--- Probing ${target.name} (${target.apiFields.length} fields) ---`);

  const resourceState = getResourceState(target.name);
  state[target.name] = resourceState;

  // Pre-populate resolved fields from previous runs
  const resolved = new Map<string, FieldHit>();
  const unresolvedSet = new Set(target.responseFields);
  for (let i = 0; i < target.apiFields.length; i++) {
    const apiField = target.apiFields[i]!;
    const prev = resourceState.resolved[apiField];
    if (prev) {
      resolved.set(apiField, prev);
      unresolvedSet.delete(target.responseFields[i]!);
      log(`  (cached) "${apiField}" already resolved at id=${prev.id}`);
    }
  }

  if (unresolvedSet.size === 0) {
    log(`  All fields already resolved from previous runs, skipping.`);
    return {
      name: target.name,
      detailPath: target.detailPath,
      resolved,
      unresolved: [],
      pagesUsed: 0,
      recordsScanned: resourceState.recordsScanned,
    };
  }

  // Check if we've already paged through all results
  if (
    resourceState.totalResults !== undefined &&
    resourceState.nextOffset >= resourceState.totalResults
  ) {
    const reason = `All ${resourceState.totalResults} records scanned, no hits for remaining fields`;
    log(`  EXHAUSTED: ${reason}`);
    const unresolved = target.apiFields.filter((_, i) =>
      unresolvedSet.has(target.responseFields[i]!),
    );
    return {
      name: target.name,
      detailPath: target.detailPath,
      resolved,
      unresolved,
      pagesUsed: 0,
      recordsScanned: resourceState.recordsScanned,
      skipped: reason,
    };
  }

  log(
    `  Resuming from offset ${resourceState.nextOffset}` +
      (resourceState.totalResults !== undefined
        ? ` of ${resourceState.totalResults} total`
        : '') +
      ` (${resourceState.recordsScanned} records scanned so far)`,
  );

  const fieldList = ['id', ...target.apiFields].join(',');
  let pagesUsed = 0;

  while (pagesUsed < target.maxPages && unresolvedSet.size > 0) {
    const params = new URLSearchParams({
      format: 'json',
      api_key: apiKey,
      field_list: fieldList,
      limit: String(PAGE_SIZE),
      offset: String(resourceState.nextOffset),
    });
    if (target.sort) {
      params.set('sort', target.sort);
    }

    const url = `${BASE_URL}${target.listPath}?${params}`;
    pagesUsed++;

    try {
      const response = (await http.get(url)) as ListResponse;
      resourceState.totalResults = response.numberOfTotalResults;
      const pageCount = response.numberOfPageResults;
      resourceState.nextOffset += pageCount;
      resourceState.recordsScanned += pageCount;

      log(
        `  Page ${pagesUsed}: offset ${resourceState.nextOffset - pageCount}, got ${pageCount} records`,
      );

      for (const record of response.results) {
        for (let i = 0; i < target.responseFields.length; i++) {
          const responseField = target.responseFields[i]!;
          const apiField = target.apiFields[i]!;
          if (!unresolvedSet.has(responseField)) continue;

          const value = record[responseField];
          if (value !== null && value !== undefined) {
            const id = record['id'] as number;
            resolved.set(apiField, { id, value });
            unresolvedSet.delete(responseField);
            resourceState.resolved[apiField] = { id, value };
            log(
              `  Found non-null "${apiField}" at id=${id}: ${previewValue(value)}`,
            );
          }
        }
      }

      // Stop if we've reached the end of the list
      if (
        pageCount < PAGE_SIZE ||
        resourceState.nextOffset >= response.numberOfTotalResults
      ) {
        log(
          `  Reached end of list (${resourceState.nextOffset}/${response.numberOfTotalResults})`,
        );
        break;
      }
    } catch (error) {
      logError(`  Page ${pagesUsed} failed:`, error);
      break;
    }
  }

  // Persist state after each resource
  saveState(state);

  const unresolved = target.apiFields.filter((_, i) =>
    unresolvedSet.has(target.responseFields[i]!),
  );

  return {
    name: target.name,
    detailPath: target.detailPath,
    resolved,
    unresolved,
    pagesUsed,
    recordsScanned: resourceState.recordsScanned,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log('=== Comic Vine Unknown Field Discovery ===\n');
  log(
    `Probing ${PROBE_TARGETS.length} resources via list API (${PAGE_SIZE} records/request).`,
  );
  log(`Log file: ${LOG_FILE}`);
  log(`State file: ${STATE_FILE}\n`);

  const results: ProbeResult[] = [];

  for (const target of PROBE_TARGETS) {
    const result = await probeResource(target);
    results.push(result);
  }

  // Summary
  log('\n\n========================================');
  log('           DISCOVERY SUMMARY');
  log('========================================');

  const suggestedUrls: { resource: string; url: string }[] = [];
  const allUnresolved: { resource: string; field: string }[] = [];
  const exhaustedFields: { resource: string; field: string }[] = [];

  for (const result of results) {
    log(
      `\n${result.name} (${result.pagesUsed} pages, ${result.recordsScanned} records scanned):`,
    );

    if (result.skipped) {
      log(`  SKIPPED: ${result.skipped}`);
    }

    if (result.resolved.size > 0) {
      log('  Resolved fields:');
      for (const [field, hit] of result.resolved) {
        log(`    - ${field}: found at id=${hit.id}`);
        log(`      Preview: ${previewValue(hit.value)}`);
      }

      const hitIds = new Set<number>();
      for (const hit of result.resolved.values()) {
        hitIds.add(hit.id);
      }
      for (const id of hitIds) {
        suggestedUrls.push({
          resource: result.name,
          url: `${BASE_URL}${result.detailPath}-${id}`,
        });
      }
    }

    if (result.unresolved.length > 0) {
      log('  Unresolved fields:');
      for (const field of result.unresolved) {
        log(`    - ${field}`);
      }
      for (const field of result.unresolved) {
        if (result.skipped) {
          exhaustedFields.push({ resource: result.name, field });
        } else {
          allUnresolved.push({ resource: result.name, field });
        }
      }
    }
  }

  if (suggestedUrls.length > 0) {
    log('\n\n--- Suggested URLs for samples/config.json ---\n');
    for (const { resource, url } of suggestedUrls) {
      log(`  ${resource}: "${url}"`);
    }
  }

  if (exhaustedFields.length > 0) {
    log('\n\n--- Exhausted: handle as type overrides ---\n');
    for (const { resource, field } of exhaustedFields) {
      log(`  ${resource}.${field}`);
    }
  }

  if (allUnresolved.length > 0) {
    log(`\n\n--- Still searching (${allUnresolved.length}) ---\n`);
    for (const { resource, field } of allUnresolved) {
      log(`  ${resource}.${field}`);
    }
  }

  if (allUnresolved.length === 0 && exhaustedFields.length === 0) {
    log('\n\nAll target fields resolved!');
  }

  logStream.end();
}

main().catch((error) => {
  logError('Fatal error:', error);
  logStream.end();
  process.exit(1);
});
