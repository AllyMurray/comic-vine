import { HttpClient } from '@http-client-toolkit/core';
import { ResourceFactory } from './resource-factory.js';
import * as resources from './resource-list.js';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from '../http-client/hooks.js';
import { UrlBuilder } from '../http-client/url-builder.js';
import type { ValueOf } from '../types/index.js';

describe('ResourceFactory', () => {
  const httpClient = new HttpClient({
    name: 'resource-factory-test-client',
    responseTransformer: comicVineResponseTransformer,
    responseHandler: comicVineResponseHandler,
    errorHandler: comicVineErrorHandler,
  });
  const urlBuilder = new UrlBuilder('mock-api-key', 'https://mock-base-url/');
  const resourceFactory = new ResourceFactory(httpClient, urlBuilder);

  type FactoryInput = keyof typeof resources;
  type ResourceClass = ValueOf<typeof resources>;
  const resourceList: Array<[FactoryInput, ResourceClass]> = [
    ['Character', resources.Character],
    ['Concept', resources.Concept],
    ['Episode', resources.Episode],
    ['Issue', resources.Issue],
    ['Location', resources.Location],
    ['Movie', resources.Movie],
    ['Origin', resources.Origin],
    ['Person', resources.Person],
    ['Power', resources.Power],
    ['Promo', resources.Promo],
    ['Publisher', resources.Publisher],
    ['Series', resources.Series],
    ['StoryArc', resources.StoryArc],
    ['Team', resources.Team],
    ['Thing', resources.Thing],
    ['VideoCategory', resources.VideoCategory],
    ['Video', resources.Video],
    ['VideoType', resources.VideoType],
    ['Volume', resources.Volume],
  ];

  test.each(resourceList)(
    'should return an instance of %s',
    (factoryInput, expectedReturnType) => {
      const resource = resourceFactory.create(factoryInput);
      expect(resource).toBeInstanceOf(expectedReturnType);
    },
  );

  it('should return throw if the resource is not implemented', () => {
    const notImplementedResourceType = 'Unknown' as keyof typeof resources;
    expect(() => resourceFactory.create(notImplementedResourceType)).toThrow(
      'Unknown resource not implemented',
    );
  });
});
