import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { Video } from './video';

describe('Video', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder('mock-api-key');

  it('should have the correct resource type', () => {
    const resource = new Video(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Video);
  });
});
