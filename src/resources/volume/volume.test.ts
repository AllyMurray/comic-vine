import { Volume } from './volume.js';
import { HttpClientFactory } from '../../http-client/index.js';
import { ResourceType } from '../resource-type.js';

describe('Volume', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/',
  );

  it('should have the correct resource type', () => {
    const resource = new Volume(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Volume);
  });
});
