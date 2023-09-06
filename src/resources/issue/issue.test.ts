import { Issue } from './issue.js';
import { HttpClientFactory } from '../../http-client/index.js';
import { ResourceType } from '../resource-type.js';

describe('Issue', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/',
  );

  it('should have the correct resource type', () => {
    const resource = new Issue(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Issue);
  });
});
