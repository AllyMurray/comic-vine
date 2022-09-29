import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Promo } from './promo';

describe('Promo', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new Promo(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Promo);
  });
});
