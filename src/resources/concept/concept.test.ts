import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Concept } from './concept';

describe('Concept', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new Concept(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Concept);
  });
});
