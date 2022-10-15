import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Thing } from './thing';

describe('Thing', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Thing(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Thing);
  });
});
