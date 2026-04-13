/**
 * Generate the source for a resource test file.
 * Template matches the current pattern using toolkit HttpClient (not old HttpClientFactory).
 */
export function generateResourceTest(
  pascalName: string,
  kebabName: string,
): string {
  return `import { HttpClient } from '@http-client-toolkit/core';
import { ${pascalName} } from './${kebabName}.js';
import {
  comicVineResponseTransformer,
  comicVineResponseHandler,
  comicVineErrorHandler,
} from '../../http-client/hooks.js';
import { UrlBuilder } from '../../http-client/url-builder.js';
import { ResourceType } from '../resource-type.js';

describe('${pascalName}', () => {
  const httpClient = new HttpClient({
    name: '${kebabName}-test-client',
    responseTransformer: comicVineResponseTransformer,
    responseHandler: comicVineResponseHandler,
    errorHandler: comicVineErrorHandler,
  });
  const urlBuilder = new UrlBuilder('mock-api-key', 'https://mock-base-url/');

  it('should have the correct resource type', () => {
    const resource = new ${pascalName}(httpClient, urlBuilder);
    expect(resource['resourceType']).toBe(ResourceType.${pascalName});
  });
});
`;
}
