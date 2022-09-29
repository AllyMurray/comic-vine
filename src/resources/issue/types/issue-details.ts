import { SiteResource, PersonCreditSiteResource, Image } from '../../common-types';

export interface IssueDetails {
    /**
     * List of aliases the issue is known by. A \n (newline) seperates each alias.
     */
    aliases: null;
    /**
     * URL pointing to the issue detail resource.
     */
    apiDetailUrl:     string;
    associatedImages: any[];
    characterCredits: Array<SiteResource>;
    characterDiedIn:  any[];
    conceptCredits: Array<SiteResource>;
    /**
     * The publish date printed on the cover of an issue.
     */
    coverDate: Date;
    /**
     * Date the issue was added to Comic Vine.
     */
    dateAdded: Date;
    /**
     * Date the issue was last updated on Comic Vine.
     */
    dateLastUpdated: Date;
    /**
     * Brief summary of the issue.
     */
    deck: null;
    /**
     * Description of the issue.
     */
    description: null;
    /**
     * A list of characters in which this issue is the first appearance of the character.
     */
    firstAppearanceCharacters: null;
    /**
     * A list of concepts in which this issue is the first appearance of the concept.
     */
    firstAppearanceConcepts: null;
    /**
     * A list of locations in which this issue is the first appearance of the location.
     */
    firstAppearanceLocations: null;
    /**
     * A list of things in which this issue is the first appearance of the object.
     */
    firstAppearanceObjects: null;
    /**
     * A list of storyarcs in which this issue is the first appearance of the story arc.
     */
    firstAppearanceStoryarcs: null;
    /**
     * A list of teams in which this issue is the first appearance of the team.
     */
    firstAppearanceTeams: null;
    hasStaffReview:       boolean;
    /**
     * Unique ID of the issue.
     */
    id: number;
    /**
     * Main image of the issue.
     */
    image: Image;
    /**
     * The number assigned to the issue within the volume set.
     */
    issueNumber:     string;
    locationCredits: any[];
    /**
     * Name of the issue.
     */
    name:          null | string;
    objectCredits: any[];
    personCredits: Array<PersonCreditSiteResource>;
    /**
     * URL pointing to the issue on Giant Bomb.
     */
    siteDetailUrl: string;
    /**
     * The date the issue was first sold in stores.
     */
    storeDate:       null;
    storyArcCredits: any[];
    teamCredits: Array<SiteResource>;
    teamDisbandedIn: any[];
    /**
     * The volume this issue is a part of.
     */
    volume: SiteResource;
}