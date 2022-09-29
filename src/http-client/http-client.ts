import axios, { AxiosError, AxiosResponse } from 'axios';
import { Response, HttpClient as HttpClientContract } from '../types';
import { convertSnakeCaseToCamelCase } from '../utils';
import { StatusCode } from './status-code';
import {
  ComicVineFilterError,
  ComicJsonpCallbackMissingError,
  ComicVineObjectNotFoundError,
  ComicVineUnauthorizedError,
  ComicVineUrlFormatError,
  ComicVineSubscriberOnlyError,
  ComicVineGenericError,
} from '../errors';
import { ComicVineError } from '../errors/comic-vine-error';

export class HttpClient implements HttpClientContract {
  private _http;

  constructor() {
    this._http = axios.create({
      transformResponse: (data: any) => {
        return data ? convertSnakeCaseToCamelCase(JSON.parse(data)) : undefined;
      },
    });
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

  private generateClientError(err: any) {
    if (err instanceof ComicVineError) {
      return err;
    }

    const error = err as AxiosError<any>;
    if (error.response?.status === 401) {
      return new ComicVineUnauthorizedError();
    }

    const errorMessage = error.response?.data?.message;
    return new ComicVineGenericError(
      `${error.message}${errorMessage ? `, ${errorMessage}` : ''}`
    );
  }

  async get<Result>(url: string) {
    try {
      return this.handleResponse(await this._http.get<Response<Result>>(url));
    } catch (error) {
      throw this.generateClientError(error);
    }
  }
}
