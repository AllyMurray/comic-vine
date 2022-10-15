import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Person } from './person';

describe('Person', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Person(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Person);
  });
});
