import {
  HttpClient,
  HttpClientStores,
  HttpClientOptions,
} from './http-client.js';
import { UrlBuilder } from './url-builder.js';

export class HttpClientFactory {
  public static createClient(
    stores: HttpClientStores = {},
    options: HttpClientOptions = {},
  ) {
    return new HttpClient(stores, options);
  }

  public static createUrlBuilder(apiKey: string, baseUrl: string) {
    return new UrlBuilder(apiKey, baseUrl);
  }
}
