import { SiteResource, Image } from '../../common-types';

export interface EpisodeDetails {
    /**
     * The air date of the episode.
     */
    airDate: Date | null;
    /**
     * List of aliases the episode is known by. A \n (newline) seperates each alias.
     */
    aliases: null;
    /**
     * URL pointing to the episode detail resource.
     */
    apiDetailUrl:     string;
    characterCredits: Array<SiteResource>;
    characterDiedIn:  any[];
    conceptCredits: Array<SiteResource>;
    /**
     * Date the episode was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the episode was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the episode.
     */
    deck: null | string;
    /**
     * Description of the episode.
     */
    description: null | string;
    /**
     * The number assigned to the episode within a series.
     */
    episodeNumber: string;
    /**
     * A list of characters in which this episode is the first appearance of the character.
     */
    firstAppearanceCharacters: null;
    /**
     * A list of concepts in which this episode is the first appearance of the concept.
     */
    firstAppearanceConcepts: null;
    /**
     * A list of locations in which this episode is the first appearance of the location.
     */
    firstAppearanceLocations: null;
    /**
     * A list of things in which this episode is the first appearance of the object.
     */
    firstAppearanceObjects: null;
    /**
     * A list of storyarcs in which this episode is the first appearance of the story arc.
     */
    firstAppearanceStoryarcs: null;
    /**
     * A list of teams in which this episode is the first appearance of the team.
     */
    firstAppearanceTeams: null;
    hasStaffReview: SiteResource;
    /**
     * Unique ID of the episode.
     */
    id: number;
    /**
     * Main image of the episode.
     */
    image:           Image;
    locationCredits: Array<SiteResource>;
    /**
     * Name of the episode.
     */
    name:          string;
    objectCredits: Array<SiteResource>;
    /**
     * The series the episode belongs to.
     */
    series: SiteResource;
    /**
     * URL pointing to the episode on Giant Bomb.
     */
    siteDetailUrl:   string;
    storyArcCredits: any[];
    teamCredits: Array<SiteResource>;
}