import { Thing } from './thing.js';
import { HttpClientFactory } from '../../http-client/index.js';
import { ResourceType } from '../resource-type.js';

describe('Thing', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key', 'https://mock-base-url/');

  it('should have the correct resource type', () => {
    const resource = new Thing(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Thing);
  });
});
