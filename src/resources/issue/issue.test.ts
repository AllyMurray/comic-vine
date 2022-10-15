import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Issue } from './issue';

describe('Issue', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Issue(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Issue);
  });
});
