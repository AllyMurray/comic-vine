// This module is loaded by Bun’s installation scanner.
const { Glob, file, TOML } = globalThis.Bun;
// Bun's resolver handles version selection; this scanner also checks frozen
// locks and fails closed when a registry omits publication timestamps.
export const scanner = {
  version: '1',
  async scan({ packages }) {
    const config = TOML.parse(await file('bunfig.toml').text()).install;
    const minimumAge = config.minimumReleaseAge * 1000;
    const excludes = (config.minimumReleaseAgeExcludes ?? []).map(
      (pattern) => new Glob(pattern),
    );
    const metadata = new Map();
    const findings = [];
    const pending = packages.filter(
      (pkg) => !excludes.some((glob) => glob.match(pkg.name)),
    );
    async function worker() {
      for (let pkg; (pkg = pending.shift());) {
        // Local tarballs/workspaces have no registry publication date.
        if (!/^https?:/.test(pkg.tarball ?? '')) continue;
        const url = new URL(pkg.tarball);
        const separator = url.pathname.lastIndexOf('/-/');
        if (separator < 0)
          throw new Error(`Cannot verify publication time for ${pkg.name}`);
        url.pathname = url.pathname.slice(0, separator);
        url.search = '';
        if (!metadata.has(url.href)) {
          metadata.set(
            url.href,
            fetch(url, { signal: AbortSignal.timeout(30000) }).then(
              async (response) => {
                if (!response.ok)
                  throw new Error(
                    `Publication metadata failed: ${response.status} for ${pkg.name}`,
                  );
                return response.json();
              },
            ),
          );
        }
        const published = Date.parse(
          (await metadata.get(url.href)).time?.[pkg.version],
        );
        if (
          !Number.isFinite(published) ||
          Date.now() - published < minimumAge
        ) {
          findings.push({
            level: 'fatal',
            package: pkg.name,
            url: null,
            description: !Number.isFinite(published)
              ? `MISSING_TIME: no publication timestamp for ${pkg.name}@${pkg.version}`
              : `Release age policy: ${pkg.name}@${pkg.version} was published too recently`,
          });
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(12, pending.length) }, worker),
    );
    return findings;
  },
};
