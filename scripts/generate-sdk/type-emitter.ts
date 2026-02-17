import type {
  InferredType,
  PropertyInfo,
  TypeDefinition,
  EnumDefinition,
  InferredTypeGraph,
} from './types.js';

/**
 * Serialize an InferredType to its TypeScript string representation.
 */
function serializeType(type: InferredType): string {
  switch (type.kind) {
    case 'primitive':
      return type.type;
    case 'null':
      return 'null';
    case 'unknown':
      return 'unknown';
    case 'literal':
      return String(type.value);
    case 'array':
      return `Array<${serializeType(type.elementType)}>`;
    case 'object':
      return type.typeName;
    case 'indexSignature':
      return `{ [key: string]: ${serializeType(type.valueType)} }`;
    case 'enum':
      return type.typeName;
    case 'commonType':
      return type.typeName;
    case 'union':
      return type.members.map(serializeType).join(' | ');
  }
}

/**
 * Collect all common type names used in a type graph for the import statement.
 */
function collectImports(graph: InferredTypeGraph): string[] {
  const imports = new Set<string>();

  function walk(type: InferredType): void {
    if (type.kind === 'commonType') {
      imports.add(type.typeName);
    } else if (type.kind === 'union') {
      for (const m of type.members) walk(m);
    } else if (type.kind === 'array') {
      walk(type.elementType);
    }
  }

  for (const prop of graph.rootType.properties) {
    walk(prop.type);
  }
  // Nested types that survived common-type replacement still need their imports
  for (const nested of graph.nestedTypes) {
    for (const prop of nested.properties) {
      walk(prop.type);
    }
  }

  return [...imports].sort();
}

/**
 * Emit a single property line with optional JSDoc comment.
 */
function emitProperty(prop: PropertyInfo): string[] {
  const lines: string[] = [];

  if (prop.description) {
    lines.push('  /**');
    lines.push(`   * ${prop.description}`);
    lines.push('   */');
  }

  const optional = prop.optional ? '?' : '';
  lines.push(`  ${prop.name}${optional}: ${serializeType(prop.type)};`);
  return lines;
}

/**
 * Emit a TypeDefinition as an exported TypeScript interface.
 */
function emitInterface(typeDef: TypeDefinition): string[] {
  const lines: string[] = [];
  lines.push(`export interface ${typeDef.name} {`);
  for (const prop of typeDef.properties) {
    lines.push(...emitProperty(prop));
  }
  lines.push('}');
  return lines;
}

/**
 * Emit an EnumDefinition as an exported TypeScript enum.
 */
function emitEnum(enumDef: EnumDefinition): string[] {
  const lines: string[] = [];
  lines.push(`export enum ${enumDef.name} {`);
  for (const member of enumDef.members) {
    lines.push(`  ${member.key} = '${member.value}',`);
  }
  lines.push('}');
  return lines;
}

/**
 * Emit a complete InferredTypeGraph as a TypeScript source file.
 */
export function emitTypeScript(graph: InferredTypeGraph): string {
  const lines: string[] = [];

  // Import statement
  const imports = collectImports(graph);
  if (imports.length > 0) {
    lines.push(
      `import { ${imports.join(', ')} } from '../../common-types.js';`,
    );
    lines.push('');
  }

  // Root interface
  lines.push(...emitInterface(graph.rootType));

  // Nested interfaces (should be empty after common-type replacement
  // unless there are non-common nested types)
  for (const nested of graph.nestedTypes) {
    lines.push('');
    lines.push(...emitInterface(nested));
  }

  // Enums
  for (const enumDef of graph.enums) {
    lines.push('');
    lines.push(...emitEnum(enumDef));
  }

  return lines.join('\n') + '\n';
}
