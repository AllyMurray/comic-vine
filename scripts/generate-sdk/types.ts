export interface ResourceConfig {
  typeName: string;
  sampleUrls: string[];
  shouldGenerate: boolean;
}

export interface CodeComment {
  title: string;
  fields: Array<{
    propertyName: string;
    comment: string;
  }>;
}

export interface CommonTypeShape {
  typeName: string;
  propList: string[];
}

export interface CommonTypeConversion {
  property: string;
  newType: string;
  isArray: boolean;
}

export interface CommonTypeMapping {
  resource: string;
  propertyConversions: CommonTypeConversion[];
}

/** Convention: sample folders with "list" in the name are list resources. */
export function isListResource(resourceFolder: string): boolean {
  return resourceFolder.includes('list');
}

// ─── Internal type representation for code generation ─────────────────────────

export type InferredType =
  | { kind: 'primitive'; type: 'string' | 'number' | 'boolean' | 'Date' }
  | { kind: 'null' }
  | { kind: 'unknown' }
  | { kind: 'literal'; value: false }
  | { kind: 'array'; elementType: InferredType }
  | { kind: 'object'; typeName: string }
  | { kind: 'indexSignature'; valueType: InferredType }
  | { kind: 'enum'; typeName: string }
  | { kind: 'commonType'; typeName: string }
  | { kind: 'union'; members: InferredType[] };

export interface PropertyInfo {
  name: string;
  type: InferredType;
  optional: boolean;
  description?: string;
}

export interface TypeDefinition {
  name: string;
  properties: PropertyInfo[];
}

export interface EnumDefinition {
  name: string;
  members: Array<{ key: string; value: string }>;
}

export interface InferredTypeGraph {
  rootType: TypeDefinition;
  nestedTypes: TypeDefinition[];
  enums: EnumDefinition[];
}
