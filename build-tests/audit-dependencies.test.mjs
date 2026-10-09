import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareAudits, parseAudit } from '../scripts/audit-dependencies.mjs';

const advisory = (overrides = {}) => ({
  id: 123,
  github_advisory_id: 'GHSA-aaaa-bbbb-cccc',
  module_name: 'vulnerable-package',
  severity: 'high',
  findings: [
    { version: '1.0.0', dev: true, paths: ['.>parent>vulnerable-package'] },
  ],
  ...overrides,
});

function report(advisories) {
  const vulnerabilities = {
    info: 0,
    low: 0,
    moderate: 0,
    high: 0,
    critical: 0,
  };
  for (const item of advisories) vulnerabilities[item.severity]++;
  return {
    advisories: Object.fromEntries(advisories.map((item, i) => [i, item])),
    metadata: { vulnerabilities },
  };
}

const parse = (advisories) =>
  parseAudit(JSON.stringify(report(advisories)), advisories.length ? 1 : 0);

test('allows unchanged findings and a security fix with unrelated findings remaining', () => {
  const unrelated = advisory({
    github_advisory_id: 'GHSA-dddd-eeee-ffff',
    module_name: 'unrelated',
  });
  const base = parse([advisory(), unrelated]);
  assert.equal(compareAudits(base, base).regressions.length, 0);
  const result = compareAudits(base, parse([unrelated]));
  assert.equal(result.regressions.length, 0);
  assert.equal(result.existing.length, 1);
  assert.equal(result.resolved.length, 1);
});

test('blocks a new advisory even when another is fixed and the total is unchanged', () => {
  const result = compareAudits(
    parse([advisory()]),
    parse([advisory({ github_advisory_id: 'GHSA-dddd-eeee-ffff' })]),
  );
  assert.equal(result.regressions.length, 1);
  assert.equal(result.resolved.length, 1);
});

test('blocks a newly affected version under an existing advisory', () => {
  const changed = advisory({
    findings: [
      { version: '1.0.1', dev: true, paths: ['.>parent>vulnerable-package'] },
    ],
  });
  assert.equal(
    compareAudits(parse([advisory()]), parse([changed])).regressions.length,
    1,
  );
});

test('blocks an increase in severity and allows a decrease', () => {
  const high = parse([advisory()]);
  const critical = parse([advisory({ severity: 'critical' })]);
  assert.equal(
    compareAudits(high, critical).regressions[0].reason,
    'severity increased',
  );
  assert.equal(compareAudits(critical, high).regressions.length, 0);
});

test('blocks development-to-runtime exposure and allows the reverse', () => {
  const development = parse([advisory()]);
  const runtime = parse([
    advisory({
      findings: [
        { version: '1.0.0', dev: false, paths: ['.>vulnerable-package'] },
      ],
    }),
  ]);
  assert.equal(compareAudits(development, runtime).regressions.length, 1);
  assert.equal(compareAudits(runtime, development).regressions.length, 0);
});

test('matches stable GHSA identifiers despite numeric ID or dependency path changes', () => {
  const moved = advisory({
    id: 999,
    findings: [
      {
        version: '1.0.0',
        dev: true,
        paths: ['.>other-parent>vulnerable-package'],
      },
    ],
  });
  assert.equal(
    compareAudits(parse([advisory()]), parse([moved])).regressions.length,
    0,
  );
});

test('keeps packages and versions distinct under the same GHSA', () => {
  const otherPackage = advisory({ module_name: 'another-package' });
  assert.equal(
    compareAudits(parse([advisory()]), parse([otherPackage])).regressions
      .length,
    1,
  );
  const multiple = advisory({
    findings: [
      { version: '1.0.0', dev: true, paths: ['.>parent>vulnerable-package'] },
      {
        version: '0.9.0',
        dev: true,
        paths: ['.>other-parent>vulnerable-package'],
      },
    ],
  });
  assert.equal(
    compareAudits(parse([advisory()]), parse([multiple])).regressions.length,
    1,
  );
});

test('accepts a valid clean report', () => {
  assert.equal(parse([]).size, 0);
});

test('fails closed on registry errors, invalid JSON, missing reports and unexpected exits', () => {
  for (const [stdout, status] of [
    ['Service unavailable', 1],
    ['{"error":{"code":"E503"}}', 1],
    ['{}', 0],
    [JSON.stringify(report([])), 2],
    [JSON.stringify(report([])), 1],
    [JSON.stringify(report([advisory()])), 0],
  ])
    assert.throws(() => parseAudit(stdout, status));
});

test('fails closed on inconsistent totals or incomplete advisory details', () => {
  const inconsistent = report([]);
  inconsistent.metadata.vulnerabilities.high = 1;
  assert.throws(() => parseAudit(JSON.stringify(inconsistent), 1));
  for (const invalid of [
    { github_advisory_id: undefined },
    { module_name: '' },
    { severity: 'unknown' },
    { findings: [] },
    { findings: [{ version: '1.0.0', paths: ['.>parent'] }] },
    { findings: [{ dev: false, paths: ['.>parent'] }] },
    { findings: [{ version: '1.0.0', dev: false, paths: [] }] },
  ])
    assert.throws(() => parse([advisory(invalid)]));
});
