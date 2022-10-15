import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Volume } from './volume';

describe('Volume', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Volume(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Volume);
  });
});
