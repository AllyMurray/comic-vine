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

export interface CommonTypeConversion {
  property: string;
  newType: string;
  isArray: boolean;
}

export interface CommonTypeMapping {
  resource: string;
  propertyConversions: CommonTypeConversion[];
}
