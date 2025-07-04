/**
 * Creates a package.json for the given build type
 */
import fs from 'fs';
import path from 'path';
import { program } from 'commander';

program
  .option('--moduleType <string>', 'The module type, cjs or esm')
  .option(
    '--packageJsonType <string>',
    'The package.json type, either commonjs or module',
  );
program.parse();

const options = program.opts();

const type = options.packageJsonType;

fs.writeFileSync(
  path.resolve('lib', options.moduleType, 'package.json'),
  JSON.stringify(
    {
      type,
    },
    null,
    2,
  ),
);
