/**
 * Interface for deduplicating concurrent API requests
 */
export interface DedupeStore {
  /**
   * Wait for the result of an existing request if one is in progress
   * @param hash The hash key of the request
   * @returns The result if found, otherwise undefined
   */
  waitFor(hash: string): Promise<any | undefined>;

  /**
   * Register a new request and get a job ID
   * @param hash The hash key of the request
   * @returns A unique job ID for this request
   */
  register(hash: string): Promise<string>;

  /**
   * Mark a request as complete with its result
   * @param hash The hash key of the request
   * @param value The result of the request
   */
  complete(hash: string, value: any): Promise<void>;

  /**
   * Mark a request as failed with an error
   * @param hash The hash key of the request
   * @param error The error that occurred
   */
  fail(hash: string, error: Error): Promise<void>;

  /**
   * Check if a request is currently in progress
   * @param hash The hash key of the request
   * @returns True if the request is in progress
   */
  isInProgress(hash: string): Promise<boolean>;
}
