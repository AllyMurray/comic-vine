// Install the actual tarball outside the repository so missing files/dependencies
// and broken package exports cannot be hidden by the development installation.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');

const root = resolve(__dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'comic-vine-consumer-'));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const tarball = join(temporary, 'comic-vine-sdk.tgz');

try {
  execFileSync('pnpm', ['pack', '--out', tarball], {
    cwd: root,
    stdio: 'inherit',
  });
  writeFileSync(
    join(temporary, 'package.json'),
    JSON.stringify({
      private: true,
      packageManager: pkg.packageManager,
      dependencies: { [pkg.name]: `file:${tarball}` },
    }),
  );
  const minimumReleaseAge = execFileSync(
    'pnpm',
    ['config', 'get', 'minimumReleaseAge'],
    { cwd: root, encoding: 'utf8' },
  ).trim();
  assert.match(minimumReleaseAge, /^\d+$/);
  writeFileSync(
    join(temporary, 'pnpm-workspace.yaml'),
    `packages:\n  - '.'\nminimumReleaseAge: ${minimumReleaseAge}\n`,
  );
  execFileSync('pnpm', ['install', '--ignore-scripts'], {
    cwd: temporary,
    stdio: 'inherit',
  });

  writeFileSync(
    join(temporary, 'consumer.cjs'),
    `const assert = require('node:assert/strict');
const ComicVine = require('comic-vine-sdk');
assert.equal(typeof ComicVine, 'function');
assert.equal(ComicVine.default, ComicVine);
assert.equal(ComicVine.ComicVine, ComicVine);
(async () => {
  const esm = await import('comic-vine-sdk');
  assert.equal(esm.default, esm.ComicVine);
  for (const name of Object.keys(esm)) {
    assert.ok(name in ComicVine, 'Missing CommonJS export: ' + name);
    assert.equal(typeof ComicVine[name], typeof esm[name]);
  }
  for (const Constructor of [ComicVine, esm.default]) {
    const client = new Constructor({ apiKey: 'test-key' });
    for (const resource of ['character', 'concept', 'episode', 'issue', 'location',
      'movie', 'origin', 'person', 'power', 'promo', 'publisher', 'series',
      'storyArc', 'team', 'thing', 'video', 'videoCategory', 'videoType', 'volume']) {
      assert.equal(typeof client[resource].list, 'function');
      assert.equal(typeof client[resource].retrieve, 'function');
    }
  }
  assert.equal(ComicVine.StatusCode.OK, esm.StatusCode.OK);
  assert.equal(typeof ComicVine.ComicVineUnauthorizedError, 'function');
  console.log('Packed ESM/CommonJS package passed on ' + process.version);
})().catch(error => { console.error(error); process.exitCode = 1; });
`,
  );
  execFileSync(process.execPath, ['consumer.cjs'], {
    cwd: temporary,
    stdio: 'inherit',
  });
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
