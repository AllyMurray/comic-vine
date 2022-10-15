import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Power } from './power';

describe('Power', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Power(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Power);
  });
});
