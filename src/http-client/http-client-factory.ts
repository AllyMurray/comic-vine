import { HttpClient } from './http-client';
import { UrlBuilder } from './url-builder';

export class HttpClientFactory {
  public static createClient() {
    return new HttpClient();
  }

  public static createUrlBuilder(apiKey: string, baseUrl: string) {
    return new UrlBuilder(apiKey, baseUrl);
  }
}
