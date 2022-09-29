import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Location } from './location';

describe('Location', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new Location(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Location);
  });
});
