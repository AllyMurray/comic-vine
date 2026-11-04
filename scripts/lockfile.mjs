// Read current Bun locks and historical pnpm release tags without installing
// dependencies or running the package manager recorded by an old commit.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

export function parseLockfile(text, filename) {
  return JSON.parse(
    execFileSync(
      'bun',
      [
        '--eval',
        `
    const text = await Bun.stdin.text();
    const data = ${filename.endsWith('.yaml') ? 'Bun.YAML.parse(text)' : 'Bun.JSON5.parse(text)'};
    console.log(JSON.stringify(Array.isArray(data) ? data.at(-1) : data));
  `,
      ],
      { input: text, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
    ),
  );
}

const split = (id) => {
  const index = id.lastIndexOf('@');
  assert(index > 0, `Invalid locked package: ${id}`);
  return { name: id.slice(0, index), version: id.slice(index + 1) };
};

export function lockGraph(text, filename, manifest) {
  const lock = parseLockfile(text, filename);
  const bun = filename === 'bun.lock';
  const importer = bun ? lock.workspaces?.[''] : lock.importers?.['.'];
  assert(importer, 'Runtime dependency absent from lockfile: root project');
  const nodes = new Map();
  if (bun) {
    for (const [key, entry] of Object.entries(lock.packages ?? {})) {
      assert(
        Array.isArray(entry) && entry.length >= 3,
        `Invalid lock entry: ${key}`,
      );
      const identity = split(entry[0]);
      nodes.set(key, {
        ...identity,
        integrity: entry[3] ?? '',
        metadata: entry[2],
      });
    }
  } else {
    for (const [key, metadata] of Object.entries(
      lock.snapshots ?? lock.packages ?? {},
    )) {
      const base = key.replace(/\(.*/, '');
      const identity = split(base);
      nodes.set(key, {
        ...identity,
        integrity: lock.packages?.[base]?.resolution?.integrity ?? '',
        metadata,
      });
    }
  }
  function resolve(name, reference, parent = '') {
    if (bun) {
      for (
        let prefix = parent;
        ;
        prefix = prefix.slice(0, Math.max(0, prefix.lastIndexOf('/')))
      ) {
        const key = prefix ? `${prefix}/${name}` : name;
        if (nodes.has(key)) return key;
        if (!prefix) break;
      }
    } else {
      const value =
        typeof reference === 'object' ? reference.version : reference;
      for (const key of [`${name}@${value}`, value])
        if (nodes.has(key)) return key;
    }
    throw new Error(
      `Runtime dependency absent from lockfile: ${name} (${reference})`,
    );
  }
  const edgeFields = ['dependencies', 'optionalDependencies'];
  function edges(source, parent = '') {
    return Object.fromEntries(
      edgeFields.map((field) => [
        field,
        Object.fromEntries(
          Object.entries(source[field] ?? {}).map(([name, ref]) => [
            name,
            resolve(name, ref, parent),
          ]),
        ),
      ]),
    );
  }
  const root = edges(importer);
  if (manifest) {
    for (const field of edgeFields)
      for (const name of Object.keys(manifest[field] ?? {})) {
        assert(
          root[field][name],
          `Runtime dependency absent from lockfile: ${name}`,
        );
      }
  }
  for (const [key, node] of nodes) node.edges = edges(node.metadata, key);
  const development = Object.fromEntries(
    Object.entries(importer.devDependencies ?? {}).map(([name, ref]) => [
      name,
      resolve(name, ref),
    ]),
  );
  function tree(entries, ancestry = new Set()) {
    return Object.fromEntries(
      Object.entries(entries).map(([name, key]) => {
        const node = nodes.get(key);
        const id = `${node.name}@${node.version}`;
        const value = {
          name: node.name,
          version: node.version,
          integrity: node.integrity,
        };
        if (!ancestry.has(id)) {
          const next = new Set([...ancestry, id]);
          for (const field of edgeFields)
            value[field] = tree(node.edges[field], next);
        }
        return [name, value];
      }),
    );
  }
  const runtime = Object.fromEntries(
    edgeFields.map((field) => [field, tree(root[field])]),
  );
  const runtimeKeys = new Set();
  function visit(key) {
    if (runtimeKeys.has(key)) return;
    runtimeKeys.add(key);
    for (const field of edgeFields)
      for (const target of Object.values(nodes.get(key).edges[field]))
        visit(target);
  }
  for (const field of edgeFields)
    for (const key of Object.values(root[field])) visit(key);
  return { nodes, root, development, runtime, runtimeKeys };
}
