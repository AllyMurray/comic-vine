import {
  IssueApiResource,
  SiteResource,
  EpisodeApiResource,
  Image,
} from '../../common-types';

export interface StoryArcListItem {
  /**
   * List of aliases the story_arc is known by. A \n (newline) seperates each alias.
   */
  aliases: null | string;
  /**
   * URL pointing to the story_arc detail resource.
   */
  apiDetailUrl: string;
  countOfIsssueAppearances: number;
  /**
   * Date the story_arc was added to Comic Vine.
   */
  dateAdded: Date;
  /**
   * Date the story_arc was last updated on Comic Vine.
   */
  dateLastUpdated: Date;
  /**
   * Brief summary of the story_arc.
   */
  deck: null | string;
  /**
   * Description of the story_arc.
   */
  description: null | string;
  firstAppearedInEpisode: EpisodeApiResource;
  /**
   * Issue where the story_arc made its first appearance.
   */
  firstAppearedInIssue: IssueApiResource;
  /**
   * Unique ID of the story_arc.
   */
  id: number;
  /**
   * Main image of the story_arc.
   */
  image: Image;
  /**
   * Name of the story_arc.
   */
  name: string;
  /**
   * The primary publisher a story_arc is attached to.
   */
  publisher: SiteResource;
  /**
   * URL pointing to the story_arc on Giant Bomb.
   */
  siteDetailUrl: string;
}
