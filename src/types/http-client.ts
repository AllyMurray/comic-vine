import { Response } from '.';

export interface HttpClient {
  get<Result>(url: string): Promise<Response<Result> | never>;
}
