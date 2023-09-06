import { ComicVine } from './comic-vine.js';
import * as resources from './resources/resource-list.js';
import type { ValueOf } from './types/index.js';

describe('ComicVine', () => {
  const mockApiKey = 'mock-api-key';

  test('should create a ComicVine instance', () => {
    const comicVine = new ComicVine(mockApiKey);
    expect(comicVine).toBeInstanceOf(ComicVine);
  });

  const comicVineInstance = new ComicVine(mockApiKey);
  type ComicVineProperty = keyof typeof comicVineInstance;
  type ResourceClass = ValueOf<typeof resources>;
  const resourceList: Array<[ComicVineProperty, ResourceClass]> = [
    ['character', resources.Character],
    ['concept', resources.Concept],
    ['episode', resources.Episode],
    ['issue', resources.Issue],
    ['location', resources.Location],
    ['movie', resources.Movie],
    ['origin', resources.Origin],
    ['person', resources.Person],
    ['power', resources.Power],
    ['promo', resources.Promo],
    ['publisher', resources.Publisher],
    ['series', resources.Series],
    ['storyArc', resources.StoryArc],
    ['team', resources.Team],
    ['thing', resources.Thing],
    ['videoCategory', resources.VideoCategory],
    ['video', resources.Video],
    ['videoType', resources.VideoType],
    ['volume', resources.Volume],
  ];

  test.each(resourceList)(
    `should expose an instance of %s`,
    (resourceProperty, ResourceType) => {
      const comicVine = new ComicVine(mockApiKey);
      expect(comicVine[resourceProperty]).toBeInstanceOf(ResourceType);
    },
  );
});
