import { HttpClientFactory } from './http-client/index.js';
import { userOptions, loadOptions } from './options/index.js';
import { ResourceFactory } from './resources/index.js';
import * as resources from './resources/resource-list.js';

function classNameToPropertyName(className: string): string {
  return className.charAt(0).toLowerCase() + className.slice(1);
}

type ResourceInstance = ReturnType<ResourceFactory['create']>;

// Create resource property type mapping dynamically
type ResourcePropertyMap = {
  [K in keyof typeof resources as Uncapitalize<K>]: InstanceType<
    (typeof resources)[K]
  >;
};

export class ComicVine implements ResourcePropertyMap {
  private resourceFactory: ResourceFactory;
  private resourceCache = new Map<string, ResourceInstance>();
  private resourceNames: string[];

  // TypeScript property declarations for static typing (will be provided by Proxy)
  declare readonly character: ResourcePropertyMap['character'];
  declare readonly concept: ResourcePropertyMap['concept'];
  declare readonly episode: ResourcePropertyMap['episode'];
  declare readonly issue: ResourcePropertyMap['issue'];
  declare readonly location: ResourcePropertyMap['location'];
  declare readonly movie: ResourcePropertyMap['movie'];
  declare readonly origin: ResourcePropertyMap['origin'];
  declare readonly person: ResourcePropertyMap['person'];
  declare readonly power: ResourcePropertyMap['power'];
  declare readonly promo: ResourcePropertyMap['promo'];
  declare readonly publisher: ResourcePropertyMap['publisher'];
  declare readonly series: ResourcePropertyMap['series'];
  declare readonly storyArc: ResourcePropertyMap['storyArc'];
  declare readonly team: ResourcePropertyMap['team'];
  declare readonly thing: ResourcePropertyMap['thing'];
  declare readonly video: ResourcePropertyMap['video'];
  declare readonly videoCategory: ResourcePropertyMap['videoCategory'];
  declare readonly videoType: ResourcePropertyMap['videoType'];
  declare readonly volume: ResourcePropertyMap['volume'];

  constructor(key: string, options?: userOptions) {
    const _options = loadOptions(options);
    const httpClient = HttpClientFactory.createClient();
    const urlBuilder = HttpClientFactory.createUrlBuilder(
      key,
      _options.baseUrl,
    );
    this.resourceFactory = new ResourceFactory(httpClient, urlBuilder);

    // Discover available resources dynamically
    this.resourceNames = Object.keys(resources);

    // Return a proxy that provides lazy loading with full type safety
    return new Proxy(this, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'string' && target.isResourceProperty(prop)) {
          return target.getResource(prop);
        }
        return Reflect.get(target, prop);
      },
    }) as ComicVine;
  }

  private isResourceProperty(prop: string): boolean {
    // Check if this property corresponds to a known resource
    const className = prop.charAt(0).toUpperCase() + prop.slice(1);
    return this.resourceNames.includes(className);
  }

  private getResource(propertyName: string): ResourceInstance {
    // Lazy loading: create resource only when first accessed
    if (!this.resourceCache.has(propertyName)) {
      const className =
        propertyName.charAt(0).toUpperCase() + propertyName.slice(1);
      try {
        const resource = this.resourceFactory.create(
          className as keyof typeof resources,
        );
        this.resourceCache.set(propertyName, resource);
      } catch (error) {
        throw new Error(`Failed to create resource '${className}': ${error}`);
      }
    }
    return this.resourceCache.get(propertyName)!;
  }

  getAvailableResources(): string[] {
    return this.resourceNames.map((name) => classNameToPropertyName(name));
  }

  hasResource(resourceName: string): boolean {
    return this.isResourceProperty(resourceName);
  }

  getResourceByName(resourceName: string): ResourceInstance | undefined {
    if (!this.isResourceProperty(resourceName)) {
      return undefined;
    }
    return this.getResource(resourceName);
  }

  isResourceLoaded(resourceName: string): boolean {
    return this.resourceCache.has(resourceName);
  }

  getCacheStats(): {
    total: number;
    loaded: number;
    loadedResources: string[];
  } {
    const total = this.resourceNames.length;
    const loaded = this.resourceCache.size;
    const loadedResources = Array.from(this.resourceCache.keys());
    return { total, loaded, loadedResources };
  }
}
