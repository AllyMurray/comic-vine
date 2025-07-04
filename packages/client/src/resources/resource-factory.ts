import * as resources from './resource-list.js';
import { HttpClient, UrlBuilder } from '../types/index.js';

export class ResourceFactory {
  private _resources = { ...resources };

  constructor(
    private httpClient: HttpClient,
    private urlBuilder: UrlBuilder,
  ) {}

  public create<T extends keyof typeof this._resources>(
    name: T,
  ): InstanceType<(typeof this._resources)[T]>;
  public create(
    name: keyof typeof this._resources,
  ): InstanceType<(typeof this._resources)[keyof typeof this._resources]> {
    if (!this._resources[name]) {
      throw new Error(`${name} resource not implemented`);
    }
    const ResourceClass = this._resources[name] as new (
      httpClient: HttpClient,
      urlBuilder: UrlBuilder,
    ) => InstanceType<(typeof this._resources)[keyof typeof this._resources]>;
    return new ResourceClass(this.httpClient, this.urlBuilder);
  }
}
