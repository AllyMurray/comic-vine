import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Character } from './character';

describe('Character', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Character(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Character);
  });
});
