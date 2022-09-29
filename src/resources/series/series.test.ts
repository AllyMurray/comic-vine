import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Series } from './series';

describe('Series', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new Series(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Series);
  });
});
