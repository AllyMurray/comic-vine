import { HttpClient } from './http-client';
import { UrlBuilder } from './url-builder';

export class HttpClientFactory {
  public static createClient() {
    return new HttpClient();
  }

  public static createUrlBuilder(apiKey: string) {
    return new UrlBuilder(apiKey);
  }
}
