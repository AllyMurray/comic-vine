import axios, { AxiosError, AxiosResponse } from 'axios';
import { StatusCode } from './status-code.js';
import { BaseError } from '../errors/base-error.js';
import {
  ComicVineFilterError,
  ComicJsonpCallbackMissingError,
  ComicVineObjectNotFoundError,
  ComicVineUnauthorizedError,
  ComicVineUrlFormatError,
  ComicVineSubscriberOnlyError,
  ComicVineGenericRequestError,
} from '../errors/index.js';
import { Response, HttpClient as HttpClientContract } from '../types/index.js';
import { convertSnakeCaseToCamelCase } from '../utils/case-converter.js';

export class HttpClient implements HttpClientContract {
  private _http;

  constructor() {
    this._http = axios.create();
  }

  private handleResponse<Result>(response: AxiosResponse<Response<Result>>) {
    switch (response.data.statusCode) {
      case StatusCode.FilterError:
        throw new ComicVineFilterError();
      case StatusCode.JsonpCallbackMissing:
        throw new ComicJsonpCallbackMissingError();
      case StatusCode.ObjectNotFound:
        throw new ComicVineObjectNotFoundError();
      case StatusCode.SubscriberOnlyVideo:
        throw new ComicVineSubscriberOnlyError();
      case StatusCode.UrlFormatError:
        throw new ComicVineUrlFormatError();
      default:
        return response.data;
    }
  }

  private generateClientError(err: unknown) {
    if (err instanceof BaseError) {
      return err;
    }

    const error = err as AxiosError<{ message?: string }>;
    if (error.response?.status === 401) {
      return new ComicVineUnauthorizedError();
    }

    const errorMessage = error.response?.data?.message;
    return new ComicVineGenericRequestError(
      `${error.message}${errorMessage ? `, ${errorMessage}` : ''}`,
    );
  }

  async get<Result>(url: string): Promise<Response<Result>> {
    try {
      const response = await this._http.get(url);
      const transformedData = response.data
        ? convertSnakeCaseToCamelCase<Response<Result>>(response.data)
        : undefined;

      return this.handleResponse({
        ...response,
        data: transformedData as Response<Result>,
      });
    } catch (error) {
      throw this.generateClientError(error);
    }
  }
}
