import { Response } from './response.js';
import { RequestPriority } from '../stores/rate-limit-store.js';

export interface HttpClient {
  /**
   * Perform a GET request.
   *
   * @param url     Full request URL
   * @param options Optional configuration – primarily an AbortSignal so
   *                callers can cancel long-running or rate-limited waits.
   */
  get<Result>(
    url: string,
    options?: {
      /**
       * AbortSignal that allows the caller to cancel the request, including any
       * internal rate-limit wait. If the signal is aborted while waiting the
       * promise rejects with an `AbortError`-like `Error` instance.
       */
      signal?: AbortSignal;
      /**
       * Priority level for the request (affects rate limiting behavior)
       */
      priority?: RequestPriority;
    },
  ): Promise<Response<Result>>;
}
