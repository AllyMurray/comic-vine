import { StatusCode } from '../http-client/status-code';

export interface Response<Result> {
  // A text string representing the status_code
  error: 'OK';
  // The value of the limit filter specified, or 100 if not specified
  limit: number;
  // The value of the offset filter specified, or 0 if not specified
  offset: number;
  // The number of results on this page
  numberOfPageResults: number;
  // The number of total results matching the filter conditions specified
  numberOfTotalResults: number;
  // An integer indicating the result of the request
  statusCode: StatusCode;
  // Zero or more items that match the filters specified
  results: Result;
}
