import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { lockGraph } from './lockfile.mjs';

const exec = promisify(execFile);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const severityRank = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

// A successful registry response is required, even when an audit returns findings.
export function parseAudit(stdout, status) {
  assert(
    [0, 1].includes(status),
    `Dependency audit failed with exit status ${status}`,
  );
  const report = JSON.parse(stdout);
  assert(isObject(report) && !report.error, 'Audit returned an error');
  assert(isObject(report.advisories), 'Audit report is missing advisories');
  assert(
    isObject(report.metadata?.vulnerabilities),
    'Audit report is missing vulnerability totals',
  );
  const advisories = Object.values(report.advisories);
  const totals = report.metadata.vulnerabilities;
  for (const severity of Object.keys(severityRank)) {
    assert(
      Number.isInteger(totals[severity]) && totals[severity] >= 0,
      `Invalid ${severity} total`,
    );
    assert.equal(
      totals[severity],
      advisories.filter((a) => a.severity === severity).length,
      'Inconsistent audit totals',
    );
  }
  assert.equal(
    status,
    advisories.length ? 1 : 0,
    'Audit exit status does not match its findings',
  );

  const findings = new Map();
  for (const advisory of advisories) {
    assert(isObject(advisory), 'Invalid advisory');
    const { github_advisory_id: id, module_name: name, severity } = advisory;
    assert(
      /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/.test(id),
      'Missing or invalid GHSA identifier',
    );
    assert(
      typeof name === 'string' && name.length > 0,
      'Missing affected package',
    );
    assert(Object.hasOwn(severityRank, severity), 'Unknown advisory severity');
    assert(
      Array.isArray(advisory.findings) && advisory.findings.length > 0,
      'Missing affected versions',
    );
    for (const finding of advisory.findings) {
      assert(
        typeof finding.version === 'string' && finding.version.length > 0,
        'Missing affected version',
      );
      assert(
        typeof finding.dev === 'boolean',
        'Missing development/runtime classification',
      );
      assert(
        Array.isArray(finding.paths) &&
          finding.paths.length > 0 &&
          finding.paths.every(
            (path) => typeof path === 'string' && path.length > 0,
          ),
        'Missing dependency paths',
      );
      const scope = finding.dev ? 'development' : 'runtime';
      const key = JSON.stringify([id, name, finding.version, scope]);
      const value = { id, name, version: finding.version, scope, severity };
      if (
        !findings.has(key) ||
        severityRank[severity] > severityRank[findings.get(key).severity]
      ) {
        findings.set(key, value);
      }
    }
  }
  return findings;
}

export function compareAudits(base, head) {
  const regressions = [];
  const existing = [];
  const resolved = [];
  for (const [key, finding] of head) {
    // Reducing exposure from runtime to development is also an improvement.
    const previous =
      base.get(key) ??
      (finding.scope === 'development'
        ? base.get(
            JSON.stringify([
              finding.id,
              finding.name,
              finding.version,
              'runtime',
            ]),
          )
        : undefined);
    if (
      !previous ||
      severityRank[finding.severity] > severityRank[previous.severity]
    ) {
      regressions.push({
        ...finding,
        reason: previous
          ? 'severity increased'
          : 'new affected version or scope',
      });
    } else {
      existing.push(finding);
    }
  }
  for (const [key, finding] of base) {
    if (!head.has(key)) resolved.push(finding);
  }
  return { regressions, existing, resolved };
}

export async function auditLockfile(lockfile, filename, fetcher = fetch) {
  const graph = lockGraph(lockfile, filename);
  const inventory = {};
  for (const node of graph.nodes.values()) {
    inventory[node.name] ??= [];
    if (!inventory[node.name].includes(node.version))
      inventory[node.name].push(node.version);
  }
  // Query the same public registry for both graphs, ignoring repository audit
  // exclusions and registry settings. No install or lifecycle hook is needed.
  const response = await fetcher(
    'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(inventory),
      signal: AbortSignal.timeout(120000),
    },
  );
  assert(response.ok, `Audit registry returned HTTP ${response.status}`);
  const bulk = await response.json();
  assert(isObject(bulk) && !bulk.error, 'Audit returned an error');
  const advisories = [];
  for (const [name, reports] of Object.entries(bulk)) {
    assert(Array.isArray(reports) && inventory[name], 'Invalid audit package');
    for (const report of reports) {
      assert(
        typeof report.vulnerable_versions === 'string' &&
          typeof report.url === 'string',
        'Invalid audit advisory',
      );
      const affected = JSON.parse(
        execFileSync(
          'bun',
          [
            '--eval',
            `
        const { versions, range } = JSON.parse(await Bun.stdin.text());
        console.log(JSON.stringify(versions.filter(version => Bun.semver.satisfies(version, range))));
      `,
          ],
          {
            encoding: 'utf8',
            input: JSON.stringify({
              versions: inventory[name],
              range: report.vulnerable_versions,
            }),
          },
        ),
      );
      const findings = [];
      for (const [key, node] of graph.nodes) {
        if (node.name === name && affected.includes(node.version))
          findings.push({
            version: node.version,
            dev: !graph.runtimeKeys.has(key),
            paths: [key],
          });
      }
      if (findings.length)
        advisories.push({
          github_advisory_id: report.url.match(
            /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/,
          )?.[0],
          module_name: name,
          severity: report.severity,
          findings,
        });
    }
  }
  const vulnerabilities = Object.fromEntries(
    Object.keys(severityRank).map((severity) => [
      severity,
      advisories.filter((item) => item.severity === severity).length,
    ]),
  );
  return parseAudit(
    JSON.stringify({
      advisories: Object.fromEntries(
        advisories.map((item, index) => [index, item]),
      ),
      metadata: { vulnerabilities },
    }),
    advisories.length ? 1 : 0,
  );
}

export async function auditProject(project, baseSha) {
  assert(
    ['.', 'docs-site'].includes(project),
    'Project must be . or docs-site',
  );
  assert(
    /^[a-f0-9]{40}$/.test(baseSha),
    'An exact PR base commit SHA is required',
  );
  const prefix = project === '.' ? '' : 'docs-site/';
  let baseLockfile, baseFilename;
  try {
    ({ stdout: baseLockfile } = await exec(
      'git',
      ['show', `${baseSha}:${prefix}bun.lock`],
      { cwd: root, maxBuffer: 16 * 1024 * 1024 },
    ));
    baseFilename = 'bun.lock';
  } catch {
    ({ stdout: baseLockfile } = await exec(
      'git',
      ['show', `${baseSha}:${prefix}pnpm-lock.yaml`],
      { cwd: root, maxBuffer: 16 * 1024 * 1024 },
    ));
    baseFilename = 'pnpm-lock.yaml';
  }
  const headLockfile = await readFile(join(root, prefix, 'bun.lock'), 'utf8');
  const audits = await Promise.allSettled([
    auditLockfile(baseLockfile, baseFilename),
    auditLockfile(headLockfile, 'bun.lock'),
  ]);
  for (const audit of audits)
    if (audit.status === 'rejected') throw audit.reason;
  return compareAudits(audits[0].value, audits[1].value);
}

const markdownCell = (value) =>
  String(value).replaceAll('|', '\\|').replaceAll(/\r?\n/g, ' ');

async function main() {
  const [project, baseSha] = process.argv.slice(2);
  const result = await auditProject(project, baseSha);
  const lines = [
    `### Dependency audit: ${project === '.' ? 'SDK' : project}`,
    '',
    `Compared with base commit ${baseSha}. Both lockfiles were audited against the current registry advisories.`,
    '',
    `${result.regressions.length} regressions; ${result.existing.length} existing affected package versions; ${result.resolved.length} removed affected package versions.`,
    '',
    '| Result | Severity | Package | Version | Scope | Advisory |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  for (const [status, findings] of Object.entries(result)) {
    for (const finding of findings) {
      lines.push(
        `| ${[status, finding.severity, finding.name, finding.version, finding.scope, finding.id].map(markdownCell).join(' | ')} |`,
      );
    }
  }
  const summary = `${lines.join('\n')}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY)
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  if (result.regressions.length > 0) {
    console.error(
      'Dependency audit failed: this PR introduces new or worsened findings.',
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(`Dependency audit could not complete: ${error.message}`);
    process.exitCode = 1;
  });
}
