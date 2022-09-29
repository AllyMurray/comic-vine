import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { StoryArc } from './story-arc';

describe('StoryArc', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new StoryArc(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.StoryArc);
  });
});
