import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Movie } from './movie';

describe('Movie', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new Movie(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Movie);
  });
});
