import { HttpClientFactory } from '../../http-client';
import { ResourceType } from '../resource-type';
import { VideoType } from './video-type';

describe('VideoType', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );

  it('should have the correct resource type', () => {
    const resource = new VideoType(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.VideoType);
  });
});
