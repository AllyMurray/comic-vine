import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual, promisify } from 'node:util';

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

// Ignore installation paths, ordering and all development-only dependencies.
// Keep dependency edges so a resolution change anywhere in the runtime graph
// counts, including a transitive security fix in a lockfile-maintenance PR.
function runtimeGraph(project) {
  return Object.fromEntries(
    ['dependencies', 'optionalDependencies'].map((field) => [
      field,
      Object.fromEntries(
        Object.entries(project[field] ?? {}).map(([name, dependency]) => {
          assert(
            typeof dependency.version === 'string' && !dependency.isMissing,
            `Missing locked runtime dependency: ${name}`,
          );
          return [
            name,
            {
              from: dependency.from,
              version: dependency.version,
              resolved: dependency.resolved,
              ...runtimeGraph(dependency),
            },
          ];
        }),
      ),
    ]),
  );
}

async function readRuntimeGraph(manifest, lockfile, directory) {
  await mkdir(directory);
  // Inspect both committed lockfiles using the same installed pnpm. Do not
  // install packages, execute hooks, or switch to a historical package manager.
  await writeFile(
    join(directory, 'package.json'),
    JSON.stringify({
      name: manifest.name,
      version: manifest.version,
      ...runtimeManifest(manifest),
    }),
  );
  await writeFile(join(directory, 'pnpm-lock.yaml'), lockfile);
  await writeFile(
    join(directory, 'pnpm-workspace.yaml'),
    "packages:\n  - '.'\n",
  );
  const { stdout } = await exec(
    'pnpm',
    ['list', '--lockfile-only', '--prod', '--depth', 'Infinity', '--json'],
    { cwd: directory, maxBuffer: 10 * 1024 * 1024 },
  );
  const projects = JSON.parse(stdout);
  assert(
    Array.isArray(projects) && projects.length === 1,
    'Expected one SDK dependency graph',
  );
  for (const field of ['dependencies', 'optionalDependencies']) {
    for (const name of Object.keys(manifest[field] ?? {})) {
      assert(
        projects[0][field]?.[name],
        `Runtime dependency absent from lockfile: ${name}`,
      );
    }
  }
  return runtimeGraph(projects[0]);
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

  const temporary = await mkdtemp(
    join(tmpdir(), 'comic-vine-runtime-release-'),
  );
  let graphChanged;
  try {
    const previousGraph = await readRuntimeGraph(
      previous,
      await git('show', `${tag}:pnpm-lock.yaml`),
      join(temporary, 'previous'),
    );
    const currentGraph = await readRuntimeGraph(
      manifest,
      await readFile(join(directory, 'pnpm-lock.yaml'), 'utf8'),
      join(temporary, 'current'),
    );
    graphChanged = !isDeepStrictEqual(previousGraph, currentGraph);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }

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
