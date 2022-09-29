import { ResourceType } from './resource-type';

interface Resource {
  detailName: string;
  listName: string;
}

const resourceMap = new Map<ResourceType, Resource>([
  [ResourceType.Character, { detailName: 'character', listName: 'characters' }],
  [ResourceType.Concept, { detailName: 'concept', listName: 'concepts' }],
  [ResourceType.Episode, { detailName: 'episode', listName: 'episodes' }],
  [ResourceType.Issue, { detailName: 'issue', listName: 'issues' }],
  [ResourceType.Location, { detailName: 'location', listName: 'locations' }],
  [ResourceType.Movie, { detailName: 'movie', listName: 'movies' }],
  [ResourceType.Origin, { detailName: 'origin', listName: 'origins' }],
  [ResourceType.Person, { detailName: 'person', listName: 'people' }],
  [ResourceType.Power, { detailName: 'power', listName: 'powers' }],
  [ResourceType.Promo, { detailName: 'promo', listName: 'promos' }],
  [ResourceType.Publisher, { detailName: 'publisher', listName: 'publishers' }],
  [ResourceType.Series, { detailName: 'series', listName: 'series_list' }],
  [ResourceType.StoryArc, { detailName: 'story_arc', listName: 'story_arcs' }],
  [ResourceType.Team, { detailName: 'team', listName: 'teams' }],
  [ResourceType.Thing, { detailName: 'object', listName: 'objects' }],
  [ResourceType.Video, { detailName: 'video', listName: 'videos' }],
  [
    ResourceType.VideoCategory,
    { detailName: 'video_category', listName: 'video_categories' },
  ],
  [
    ResourceType.VideoCategory,
    { detailName: 'video_type', listName: 'video_types' },
  ],
  [ResourceType.Volume, { detailName: 'volume', listName: 'volumes' }],
]);

export const getResource = (resourceType: ResourceType) => {
  const resource = resourceMap.get(resourceType);
  if (!resource) {
    throw new Error(`Resource type (${resourceType}) not found`);
  }
  return resource;
};
