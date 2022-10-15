import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Team } from './team';

describe('Team', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new Team(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Team);
  });
});
