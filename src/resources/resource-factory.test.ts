import type { ValueOf } from '../types';

import { HttpClientFactory } from '../http-client';
import { ResourceFactory } from './resource-factory';
import * as resources from './resource-list';

describe('ResourceFactory', () => {
  const httpClient = HttpClientFactory.createClient();
  const urlBuilder = HttpClientFactory.createUrlBuilder(
    'mock-api-key',
    'https://mock-base-url/'
  );
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
    }
  );

  it('should return throw if the resource is not implemented', () => {
    const notImplementedResourceType = 'Unknown' as any;
    expect(() => resourceFactory.create(notImplementedResourceType)).toThrow(
      'Unknown resource not implemented'
    );
  });
});
