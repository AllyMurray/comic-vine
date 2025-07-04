import { Location } from './location.js';
import { HttpClientFactory } from '../../http-client/index.js';
import { ResourceType } from '../resource-type.js';

describe('Location', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/',
  );

  it('should have the correct resource type', () => {
    const resource = new Location(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Location);
  });
});
