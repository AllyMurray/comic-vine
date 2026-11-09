import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkBunVersion } from '../scripts/check-bun-version.mjs';

function fixture(t, version = '1.4.4-canary.20261104.1') {
  const root = mkdtempSync(join(tmpdir(), 'bun-version-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'docs-site'));
  writeFileSync(join(root, '.bun-version'), `${version}\n`);
  for (const file of ['package.json', 'docs-site/package.json']) {
    writeFileSync(
      join(root, file),
      JSON.stringify({ packageManager: `bun@${version}` }),
    );
  }
  return root;
}

test('accepts synchronized stable and exact canary versions', (t) => {
  for (const version of ['1.4.4', '1.4.4-canary.20261104.1']) {
    assert.equal(checkBunVersion(fixture(t, version)), version);
  }
});

for (const file of ['package.json', 'docs-site/package.json']) {
  for (const packageManager of [
    undefined,
    'pnpm@1.4.4',
    'bun@^1.4.4',
    'bun@1.4.4-canary.20261104.2',
  ]) {
    test(`rejects ${file} with ${packageManager}`, (t) => {
      const root = fixture(t);
      writeFileSync(join(root, file), JSON.stringify({ packageManager }));
      assert.throws(() => checkBunVersion(root), /expected packageManager/);
    });
  }
}

test('rejects runtime-only drift and floating runtime pins', (t) => {
  const root = fixture(t);
  writeFileSync(join(root, '.bun-version'), '1.4.5\n');
  assert.throws(() => checkBunVersion(root), /expected packageManager/);
  for (const version of ['', 'canary', 'latest', '^1.4.4', '1.4.4\n1.4.5']) {
    writeFileSync(join(root, '.bun-version'), version);
    assert.throws(() => checkBunVersion(root), /one exact Bun version/);
  }
});

test('missing declarations fail closed', (t) => {
  const root = fixture(t);
  rmSync(join(root, 'docs-site/package.json'));
  assert.throws(() => checkBunVersion(root), /ENOENT/);
});

test('CLI validates repository independently of working directory', () => {
  const result = spawnSync(
    process.execPath,
    [new URL('../scripts/check-bun-version.mjs', import.meta.url).pathname],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Bun declarations agree/);
});
