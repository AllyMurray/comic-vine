import { Response } from './response.js';

export interface HttpClient {
  get<Result>(url: string): Promise<Response<Result>>;
}
