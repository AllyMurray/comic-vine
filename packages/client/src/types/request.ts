import type { RequestPriority } from '../stores/rate-limit-store.js';

export interface BaseOptions<FieldKey> {
  /**
   * List of field names to include in the response.
   * Use this if you want to reduce the size of the response payload
   */
  fieldList?: Array<FieldKey>;
}

export interface PriorityOptions {
  /**
   * Priority level for the request (affects rate limiting behavior)
   * - 'user': High priority, gets reserved capacity during activity
   * - 'background': Lower priority, may be throttled during high user activity
   */
  priority?: RequestPriority;
}

export interface RetrieveOptions<FieldKey>
  extends BaseOptions<FieldKey>,
    PriorityOptions {}

export interface ListOptions<FieldKey, Filter>
  extends BaseOptions<FieldKey>,
    PriorityOptions {
  /**
   * The number of results to display per page
   * This value defaults to 100 and can not exceed this number
   */
  limit?: number;

  /**
   * Return results starting with the object at the offset specified
   */
  offset?: number;

  /**
   * The result set can be sorted by field in ascending or descending order
   */
  sort?: Sort;

  /**
   * The results can be filtered by field
   */
  filter?: Filter;
}

export interface Sort {
  field: string;
  direction: 'asc' | 'desc';
}
