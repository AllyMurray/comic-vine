import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';
import { lockGraph } from './lockfile.mjs';

const exec = promisify(execFile);
const runtimeFields = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
];
const changesetPath = '.changeset/auto-runtime-dependencies.md';

function runtimeManifest(manifest) {
  return Object.fromEntries(
    runtimeFields.map((field) => [field, manifest[field] ?? {}]),
  );
}

export async function prepareRuntimeRelease(directory = process.cwd()) {
  const git = async (...args) =>
    (await exec('git', args, { cwd: directory, maxBuffer: 10 * 1024 * 1024 }))
      .stdout;
  const manifest = JSON.parse(
    await readFile(join(directory, 'package.json'), 'utf8'),
  );
  let tag;
  try {
    tag = (
      await git(
        'describe',
        '--tags',
        '--match',
        `${manifest.name}@*`,
        '--abbrev=0',
        'HEAD',
      )
    ).trim();
  } catch (error) {
    throw new Error(
      `Cannot find a release tag for ${manifest.name}; fetch the full history and release tags before preparing a release.`,
      { cause: error },
    );
  }
  const previous = JSON.parse(await git('show', `${tag}:package.json`));
  assert.equal(
    previous.name,
    manifest.name,
    'Release tag belongs to another package',
  );

  let previousLock, previousFilename;
  try {
    previousLock = await git('show', `${tag}:bun.lock`);
    previousFilename = 'bun.lock';
  } catch {
    previousLock = await git('show', `${tag}:pnpm-lock.yaml`);
    previousFilename = 'pnpm-lock.yaml';
  }
  let currentLock, currentFilename;
  try {
    currentLock = await readFile(join(directory, 'bun.lock'), 'utf8');
    currentFilename = 'bun.lock';
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    currentLock = await readFile(join(directory, 'pnpm-lock.yaml'), 'utf8');
    currentFilename = 'pnpm-lock.yaml';
  }
  const graphChanged = !isDeepStrictEqual(
    lockGraph(previousLock, previousFilename, previous).runtime,
    lockGraph(currentLock, currentFilename, manifest).runtime,
  );

  if (
    !graphChanged &&
    isDeepStrictEqual(runtimeManifest(previous), runtimeManifest(manifest))
  ) {
    console.log(
      `No runtime dependency changes since ${tag}; no automatic Changeset needed.`,
    );
    return false;
  }

  const summary = [];
  for (const field of runtimeFields) {
    if (field === 'peerDependenciesMeta') continue;
    const before = previous[field] ?? {};
    const after = manifest[field] ?? {};
    for (const name of [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].sort()) {
      if (before[name] === after[name]) continue;
      summary.push(
        `- \`${name}\` (${field}): \`${before[name] ?? 'absent'}\` → \`${after[name] ?? 'removed'}\`.`,
      );
    }
  }
  if (graphChanged)
    summary.push(
      '- Refresh locked runtime dependencies, including transitive resolutions.',
    );
  if (
    !isDeepStrictEqual(
      previous.peerDependenciesMeta ?? {},
      manifest.peerDependenciesMeta ?? {},
    )
  ) {
    summary.push('- Update runtime peer dependency requirements.');
  }
  await mkdir(join(directory, '.changeset'), { recursive: true });
  await writeFile(
    join(directory, changesetPath),
    `---\n${JSON.stringify(manifest.name)}: patch\n---\n\nUpdate runtime dependencies since ${tag}.\n\n${summary.join('\n')}\n`,
  );
  console.log(
    `Created ${changesetPath} for runtime dependency changes since ${tag}.`,
  );
  return true;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  prepareRuntimeRelease().catch((error) => {
    console.error(
      `Could not prepare runtime dependency release: ${error.message}`,
    );
    process.exitCode = 1;
  });
}
