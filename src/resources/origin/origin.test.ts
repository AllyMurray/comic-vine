import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Origin } from './origin';

describe('Origin', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Origin(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Origin);
  });
});
