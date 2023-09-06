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
    return new (this._resources[name] as any)(this.httpClient, this.urlBuilder);
  }
}
