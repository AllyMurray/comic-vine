// Exercise pnpm's actual resolver against a local registry with dated releases.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const http = require('node:http');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const packageManager = require('../package.json').packageManager;

function run(args, cwd) {
  return new Promise((resolveRun, reject) => {
    const child = spawn('pnpm', args, { cwd });
    let output = '';
    child.stdout.on('data', (data) => (output += data));
    child.stderr.on('data', (data) => (output += data));
    child.on('error', reject);
    child.on('close', (code) => resolveRun({ code, output }));
  });
}

async function main() {
  const temporary = await fs.mkdtemp(join(tmpdir(), 'comic-vine-age-policy-'));
  const now = Date.now();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    const name = decodeURIComponent(
      url.pathname.replace(/^\/(missing-time\/|fresh-transitive\/)?/, ''),
    );
    if (
      ![
        'age-policy-probe',
        'age-policy-transitive',
        '@http-client-toolkit/age-policy-probe',
      ].includes(name)
    ) {
      response.writeHead(404).end();
      return;
    }
    const metadata = { name, 'dist-tags': { latest: '1.0.1' }, versions: {} };
    for (const version of ['1.0.0', '1.0.1']) {
      metadata.versions[version] = {
        name,
        version,
        dist: {
          tarball: `http://127.0.0.1:${server.address().port}/${name}-${version}.tgz`,
          shasum: '0000000000000000000000000000000000000000',
        },
        ...(name !== 'age-policy-transitive'
          ? {
              dependencies: {
                'age-policy-transitive': url.pathname.startsWith(
                  '/fresh-transitive/',
                )
                  ? '1.0.1'
                  : '*',
              },
            }
          : {}),
      };
    }
    if (!url.pathname.startsWith('/missing-time/')) {
      metadata.time = {
        '1.0.0': new Date(now - 48 * 60 * 60 * 1000).toISOString(),
        '1.0.1': new Date(now - 60 * 60 * 1000).toISOString(),
      };
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(metadata));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    for (const project of ['.', 'docs-site']) {
      for (const scenario of [
        'range',
        'exact',
        'missing-time',
        'frozen',
        'toolkit',
        'fresh-transitive',
      ]) {
        const isToolkit =
          scenario === 'toolkit' || scenario === 'fresh-transitive';
        const cwd = join(temporary, project, scenario);
        await fs.mkdir(cwd, { recursive: true });
        await fs.copyFile(
          join(root, project, 'pnpm-workspace.yaml'),
          join(cwd, 'pnpm-workspace.yaml'),
        );
        await fs.writeFile(
          join(cwd, 'package.json'),
          JSON.stringify({
            name: 'age-policy-consumer',
            private: true,
            packageManager,
            dependencies: {
              [isToolkit
                ? '@http-client-toolkit/age-policy-probe'
                : 'age-policy-probe']:
                isToolkit || scenario === 'exact' ? '1.0.1' : '*',
            },
          }),
        );
        const options = [
          '--lockfile-only',
          '--ignore-scripts',
          `--registry=http://127.0.0.1:${server.address().port}/${['missing-time', 'fresh-transitive'].includes(scenario) ? `${scenario}/` : ''}`,
          '--store-dir',
          join(cwd, 'store'),
        ];
        let result = await run(
          ['install', '--no-frozen-lockfile', ...options],
          cwd,
        );
        if (scenario === 'range' || scenario === 'frozen') {
          assert.equal(result.code, 0, result.output);
          const lockPath = join(cwd, 'pnpm-lock.yaml');
          const lock = await fs.readFile(lockPath, 'utf8');
          for (const name of ['age-policy-probe', 'age-policy-transitive']) {
            assert.ok(lock.includes(`${name}@1.0.0:`), lock);
            assert.ok(!lock.includes(`${name}@1.0.1:`), lock);
          }
          if (scenario === 'frozen') {
            // Simulate a lockfile contributed under a weaker release-age policy.
            await fs.writeFile(lockPath, lock.replaceAll('1.0.0', '1.0.1'));
            result = await run(
              ['install', '--frozen-lockfile', ...options],
              cwd,
            );
          }
        }
        if (scenario === 'toolkit') {
          assert.equal(result.code, 0, result.output);
          const lock = await fs.readFile(join(cwd, 'pnpm-lock.yaml'), 'utf8');
          assert.ok(
            lock.includes('@http-client-toolkit/age-policy-probe@1.0.1'),
            lock,
          );
          assert.ok(lock.includes('age-policy-transitive@1.0.0:'), lock);
          assert.ok(!lock.includes('age-policy-transitive@1.0.1:'), lock);
          result = await run(['install', '--frozen-lockfile', ...options], cwd);
          assert.equal(result.code, 0, result.output);
        } else if (scenario !== 'range') {
          assert.notEqual(result.code, 0, result.output);
          assert.match(
            result.output,
            scenario === 'missing-time'
              ? /missing.*["']time["']|MISSING_TIME/i
              : /release.age|minimumReleaseAge|NO_MATCHING_VERSION|too (new|recent)|publish/i,
          );
        }
        console.log(`Release-age policy passed: ${project} / ${scenario}`);
      }
    }
  } finally {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
