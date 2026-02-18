import fs from 'node:fs';
import path from 'node:path';
import { HttpClient } from '@http-client-toolkit/core';
import { InMemoryRateLimitStore } from '@http-client-toolkit/store-memory';
import { kebabCase } from 'change-case';
import type { ResourceConfig } from './generate-sdk/types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SAMPLES_DIR = path.join(ROOT, 'samples');

const apiKey = process.env.COMIC_VINE_API_KEY;
if (!apiKey) {
  console.error('Error: COMIC_VINE_API_KEY environment variable is required');
  process.exit(1);
}

const http = new HttpClient({
  rateLimit: new InMemoryRateLimitStore({
    defaultConfig: { limit: 3, windowMs: 1000 },
  }),
  throwOnRateLimit: false,
  maxWaitTime: 10_000,
  retry: { maxRetries: 3 },
});

async function fetchResource(url: string): Promise<unknown> {
  return http.get(`${url}?format=json&api_key=${apiKey}`);
}

function getFileName(url: string): string {
  return url
    .replace('https://comicvine.gamespot.com/api/', '')
    .replaceAll('/', '-');
}

async function main() {
  const config: ResourceConfig[] = JSON.parse(
    fs.readFileSync(path.join(SAMPLES_DIR, 'config.json'), 'utf-8'),
  );

  const activeResources = config.filter((x) => x.shouldGenerate);
  console.log(
    `Fetching samples for ${activeResources.length} resource types...`,
  );

  const failedUrls: string[] = [];

  for (const resourceConfig of activeResources) {
    const resourcePath = path.join(
      SAMPLES_DIR,
      'api-data',
      kebabCase(resourceConfig.typeName),
    );
    fs.mkdirSync(resourcePath, { recursive: true });

    for (const url of resourceConfig.sampleUrls) {
      console.log(`Fetching - ${url}`);
      try {
        const sampleApiResponse = await fetchResource(url);
        fs.writeFileSync(
          path.join(resourcePath, `${getFileName(url)}.json`),
          JSON.stringify(sampleApiResponse),
        );
      } catch (error) {
        failedUrls.push(url);
        console.error('Failed to fetch api resource', error);
      }
    }
  }

  if (failedUrls.length > 0) {
    console.log(`\nFailed URLs:\n${failedUrls.join('\n')}`);
  } else {
    console.log('\nAll samples fetched successfully!');
  }
}

main().catch((error) => {
  console.error('Failed to fetch samples:', error);
  process.exit(1);
});
