import { HttpClient } from '@http-client-toolkit/core';
import { Episode } from './episode.js';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from '../../http-client/hooks.js';
import { UrlBuilder } from '../../http-client/url-builder.js';
import { ResourceType } from '../resource-type.js';

describe('Episode', () => {
  const httpClient = new HttpClient({
    name: 'episode-test-client',
    responseTransformer: comicVineResponseTransformer,
    responseHandler: comicVineResponseHandler,
    errorHandler: comicVineErrorHandler,
  });
  const urlBuilder = new UrlBuilder('mock-api-key', 'https://mock-base-url/');

  it('should have the correct resource type', () => {
    const resource = new Episode(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.Episode);
  });
});
