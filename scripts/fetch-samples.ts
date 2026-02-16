import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';
import rateLimit from 'axios-rate-limit';
import { toParamCase } from './generate-sdk/utils.js';
import type { ResourceConfig } from './generate-sdk/types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const SAMPLES_DIR = path.join(ROOT, 'samples');

const apiKey = process.env.COMIC_VINE_API_KEY;
if (!apiKey) {
  console.error('Error: COMIC_VINE_API_KEY environment variable is required');
  process.exit(1);
}

const http = rateLimit(axios.create(), {
  maxRPS: 3,
});

async function fetchResource(url: string): Promise<unknown> {
  const response = await http.get(`${url}?format=json&api_key=${apiKey}`);
  return response.data;
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
      toParamCase(resourceConfig.typeName),
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
