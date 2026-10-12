import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { prepareRuntimeRelease } from '../scripts/prepare-runtime-release.mjs';

const exec = promisify(execFile);
const generated = '.changeset/auto-runtime-dependencies.md';
const cli = fileURLToPath(
  new URL('../node_modules/@changesets/cli/bin.js', import.meta.url),
);

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'comic-vine-release-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const git = (...args) => exec('git', args, { cwd: directory });
  const write = (path, content) => writeFile(join(directory, path), content);
  const manifest = {
    name: 'comic-vine-sdk',
    version: '1.0.0',
    dependencies: { runtime: '1.0.0' },
    optionalDependencies: { optional: '1.0.0' },
    devDependencies: { tooling: '1.0.0' },
  };
  const saveManifest = () => write('package.json', JSON.stringify(manifest));
  const saveLock = ({
    runtime = '1.0.0',
    transitive = '1.0.0',
    tooling = '1.0.0',
    optional = '1.0.0',
  } = {}) =>
    write(
      'pnpm-lock.yaml',
      `lockfileVersion: '9.0'
settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false
importers:
  .:
    dependencies:
      runtime:
        specifier: ${runtime}
        version: ${runtime}
    optionalDependencies:
      optional:
        specifier: ${optional}
        version: ${optional}
    devDependencies:
      tooling:
        specifier: ${tooling}
        version: ${tooling}
packages:
  runtime@${runtime}:
    resolution: {integrity: sha512-runtime}
  optional@${optional}:
    resolution: {integrity: sha512-optional}
  transitive@${transitive}:
    resolution: {integrity: sha512-transitive}
  tooling@${tooling}:
    resolution: {integrity: sha512-tooling}
snapshots:
  runtime@${runtime}:
    dependencies:
      transitive: ${transitive}
  optional@${optional}: {}
  transitive@${transitive}: {}
  tooling@${tooling}: {}
`,
    );
  const commit = async () => {
    await git('add', '.');
    await git(
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '-qm',
      'fixture change',
    );
  };
  await mkdir(join(directory, '.changeset'));
  await write('.changeset/README.md', '# Changesets\n');
  await write(
    '.changeset/config.json',
    JSON.stringify({
      changelog: '@changesets/cli/changelog',
      commit: false,
      fixed: [],
      linked: [],
      access: 'public',
      baseBranch: 'main',
      updateInternalDependencies: 'patch',
      ignore: [],
    }),
  );
  await write('pnpm-workspace.yaml', "packages:\n  - '.'\n");
  await saveManifest();
  await saveLock();
  await git('init', '-q', '-b', 'main');
  await git('config', 'user.name', 'Release Test');
  await git('config', 'user.email', 'release-test@example.invalid');
  await commit();
  await git('tag', 'comic-vine-sdk@1.0.0');
  return { directory, manifest, git, write, saveManifest, saveLock, commit };
}

test('ignores development dependencies, tooling, docs, Actions and manifest ordering', async (t) => {
  const f = await fixture(t);
  f.manifest.devDependencies.tooling = '2.0.0';
  f.manifest.packageManager = 'pnpm@12.6.0';
  f.manifest.scripts = { build: 'new-build-tool' };
  await f.write(
    'package.json',
    JSON.stringify(
      Object.fromEntries(Object.entries(f.manifest).reverse()),
      null,
      2,
    ),
  );
  await f.saveLock({ tooling: '2.0.0' });
  await mkdir(join(f.directory, 'docs-site'));
  await f.write(
    'docs-site/package.json',
    '{"dependencies":{"runtime":"9.0.0"}}',
  );
  await f.write('docs-site/pnpm-lock.yaml', 'docs lockfile change');
  await mkdir(join(f.directory, '.github/workflows'), { recursive: true });
  await f.write('.github/workflows/build.yml', 'name: updated actions');
  await f.commit();
  assert.equal(await prepareRuntimeRelease(f.directory), false);
  assert.deepEqual((await readdir(join(f.directory, '.changeset'))).sort(), [
    'README.md',
    'config.json',
  ]);
});

test('creates one patch changeset for runtime updates since the release, across later commits', async (t) => {
  const f = await fixture(t);
  f.manifest.dependencies.runtime = '1.1.0';
  await f.saveManifest();
  await f.saveLock({ runtime: '1.1.0' });
  await f.commit();
  await f.write('README.md', 'A later unrelated change');
  await f.commit();
  assert.equal(await prepareRuntimeRelease(f.directory), true);
  const content = await readFile(join(f.directory, generated), 'utf8');
  assert.match(content, /"comic-vine-sdk": patch/);
  assert.match(content, /`runtime` \(dependencies\): `1.0.0` → `1.1.0`/);
  assert.equal(await prepareRuntimeRelease(f.directory), true);
  assert.equal(await readFile(join(f.directory, generated), 'utf8'), content);
});

test('includes lockfile-only updates to transitive runtime dependencies', async (t) => {
  const f = await fixture(t);
  await f.saveLock({ transitive: '1.0.1' });
  assert.equal(await prepareRuntimeRelease(f.directory), true);
  assert.match(
    await readFile(join(f.directory, generated), 'utf8'),
    /transitive resolutions/,
  );
});

test('includes optional runtime updates', async (t) => {
  const f = await fixture(t);
  f.manifest.optionalDependencies.optional = '1.0.1';
  await f.saveManifest();
  await f.saveLock({ optional: '1.0.1' });
  assert.equal(await prepareRuntimeRelease(f.directory), true);
});

test('includes peer range and optional-peer metadata changes', async (t) => {
  const f = await fixture(t);
  f.manifest.peerDependencies = { host: '^1.0.0' };
  await f.saveManifest();
  assert.equal(await prepareRuntimeRelease(f.directory), true);
  await rm(join(f.directory, generated));
  f.manifest.version = '1.0.1';
  await f.saveManifest();
  await f.commit();
  await f.git('tag', 'comic-vine-sdk@1.0.1');
  f.manifest.peerDependenciesMeta = { host: { optional: true } };
  await f.saveManifest();
  assert.equal(await prepareRuntimeRelease(f.directory), true);
  assert.match(
    await readFile(join(f.directory, generated), 'utf8'),
    /peer dependency requirements/,
  );
});

for (const [bump, expected] of [
  [null, '1.0.1'],
  ['patch', '1.0.1'],
  ['minor', '1.1.0'],
  ['major', '2.0.0'],
]) {
  test(`Changesets versions runtime updates with ${bump ? `an explicit ${bump} Changeset` : 'no manual Changeset'}`, async (t) => {
    const f = await fixture(t);
    await f.saveLock({ transitive: '1.0.1' });
    const manual = `---\n"comic-vine-sdk": ${bump}\n---\n\nExplicit SDK change.\n`;
    if (bump) await f.write('.changeset/manual.md', manual);
    await f.commit();
    assert.equal(await prepareRuntimeRelease(f.directory), true);
    if (bump) {
      assert.equal(
        await readFile(join(f.directory, '.changeset/manual.md'), 'utf8'),
        manual,
      );
    }
    await exec(process.execPath, [cli, 'version'], { cwd: f.directory });
    const versioned = JSON.parse(
      await readFile(join(f.directory, 'package.json'), 'utf8'),
    );
    assert.equal(versioned.version, expected);
    const changelog = await readFile(join(f.directory, 'CHANGELOG.md'), 'utf8');
    if (bump) assert.match(changelog, /Explicit SDK change/);
    assert.match(changelog, /Update runtime dependencies/);
    await assert.rejects(readFile(join(f.directory, generated)), {
      code: 'ENOENT',
    });
    await f.commit();
    await f.git('tag', `comic-vine-sdk@${expected}`);
    assert.equal(await prepareRuntimeRelease(f.directory), false);
  });
}

test('fails clearly without release history instead of silently skipping a release', async (t) => {
  const f = await fixture(t);
  await f.git('tag', '-d', 'comic-vine-sdk@1.0.0');
  await assert.rejects(
    prepareRuntimeRelease(f.directory),
    /Cannot find a release tag/,
  );
});

test('fails if the lockfile cannot supply the declared runtime graph', async (t) => {
  const f = await fixture(t);
  await f.write('pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters: {}\n");
  await assert.rejects(
    prepareRuntimeRelease(f.directory),
    /Runtime dependency absent/,
  );
  await assert.rejects(readFile(join(f.directory, generated)), {
    code: 'ENOENT',
  });
});
