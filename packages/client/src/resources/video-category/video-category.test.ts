import { VideoCategory } from './video-category.js';
import { HttpClientFactory } from '../../http-client/index.js';
import { ResourceType } from '../resource-type.js';

describe('VideoCategory', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/',
  );

  it('should have the correct resource type', () => {
    const resource = new VideoCategory(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.VideoCategory);
  });
});
