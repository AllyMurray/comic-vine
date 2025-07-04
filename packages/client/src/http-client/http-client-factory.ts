import { HttpClient } from './http-client.js';
import { UrlBuilder } from './url-builder.js';

export class HttpClientFactory {
  public static createClient() {
    return new HttpClient();
  }

  public static createUrlBuilder(apiKey: string, baseUrl: string) {
    return new UrlBuilder(apiKey, baseUrl);
  }
}
