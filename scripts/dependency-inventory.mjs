// Generate an SPDX inventory directly from bun.lock, without installing code.
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { lockGraph } from './lockfile.mjs';
const [directory = '.', output] = process.argv.slice(2);
if (!output)
  throw new Error(
    'Usage: node scripts/dependency-inventory.mjs <project> <output>',
  );
const manifest = JSON.parse(
  await readFile(join(directory, 'package.json'), 'utf8'),
);
const graph = lockGraph(
  await readFile(join(directory, 'bun.lock'), 'utf8'),
  'bun.lock',
  manifest,
);
const id = (key) => `SPDXRef-${createHash('sha256').update(key).digest('hex')}`;
const relationships = [];
const addEdges = (source, targets) => {
  for (const target of targets)
    relationships.push({
      spdxElementId: source,
      relationshipType: 'DEPENDS_ON',
      relatedSpdxElement: id(target),
    });
};
addEdges('SPDXRef-RootPackage', [
  ...Object.values(graph.root.dependencies),
  ...Object.values(graph.root.optionalDependencies),
  ...Object.values(graph.development),
]);
const packages = [
  {
    SPDXID: 'SPDXRef-RootPackage',
    name: manifest.name,
    versionInfo: manifest.version ?? '0.0.0',
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
  },
];
for (const [key, node] of graph.nodes) {
  packages.push({
    SPDXID: id(key),
    name: node.name,
    versionInfo: node.version,
    downloadLocation: 'NOASSERTION',
    filesAnalyzed: false,
    externalRefs: [
      {
        referenceCategory: 'PACKAGE-MANAGER',
        referenceType: 'purl',
        referenceLocator: `pkg:npm/${node.name.replace('@', '%40')}@${node.version}`,
      },
    ],
  });
  addEdges(id(key), [
    ...Object.values(node.edges.dependencies),
    ...Object.values(node.edges.optionalDependencies),
  ]);
}
await writeFile(
  resolve(output),
  JSON.stringify(
    {
      spdxVersion: 'SPDX-2.3',
      dataLicense: 'CC0-1.0',
      SPDXID: 'SPDXRef-DOCUMENT',
      name: manifest.name,
      documentNamespace: `https://spdx.org/spdxdocs/${manifest.name}-${randomUUID()}`,
      creationInfo: {
        created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
        creators: ['Tool: bun-lock-inventory'],
      },
      documentDescribes: ['SPDXRef-RootPackage'],
      packages,
      relationships,
    },
    null,
    2,
  ) + '\n',
);
