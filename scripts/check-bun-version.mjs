import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run before installation so a mismatched package manager cannot hide the error.
export function checkBunVersion(root) {
  const version = readFileSync(resolve(root, '.bun-version'), 'utf8').trim();
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('.bun-version must contain one exact Bun version');
  }
  for (const file of ['package.json', 'docs-site/package.json']) {
    const { packageManager } = JSON.parse(
      readFileSync(resolve(root, file), 'utf8'),
    );
    if (packageManager !== `bun@${version}`) {
      throw new Error(
        `${file}: expected packageManager bun@${version}, got ${packageManager}. Update both manifests and .bun-version together.`,
      );
    }
  }
  return version;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    `Bun declarations agree: ${checkBunVersion(resolve(import.meta.dirname, '..'))}`,
  );
}
