import * as cheerio from 'cheerio';
import pluralize from 'pluralize';
import { toCamelCase, toSnakeCase } from './utils.js';
import type { CodeComment } from './types.js';

const replaceReservedWords = (input: string): string => {
  return input.replace('object', 'thing');
};

/**
 * Parse the Comic Vine API documentation HTML and extract property descriptions
 * for each resource type.
 */
export function extractCommentsFromHtml(htmlContent: string): CodeComment[] {
  const $ = cheerio.load(htmlContent);
  const $resourceTables = $('h3 + table > tbody');

  const resourceMetaCollection: CodeComment[] = [];
  $resourceTables.each((_i, table) => {
    let currentPropertyCollection = '';
    const resourceMeta: Record<string, unknown> = {};

    $(table)
      .children()
      .each((i, tableRow) => {
        const $tableRow = $(tableRow);

        // Extract the title from the first row
        const isTitleRow = i === 0;
        if (isTitleRow) {
          const title = replaceReservedWords(
            toCamelCase($tableRow.first().first().text().replace('URL: /', '')),
          );
          resourceMeta.title = pluralize.isSingular(title)
            ? `${title}Details`
            : `${pluralize.singular(title)}ListItem`;
          return;
        }

        const resourceHeaderRow = 1;
        const resourceListHeaderRow = 3;
        const isNewSection = [
          resourceHeaderRow,
          resourceListHeaderRow,
        ].includes($tableRow.children().length);
        if (isNewSection) {
          currentPropertyCollection = toCamelCase(
            $tableRow.children().first().text(),
          );
          resourceMeta[currentPropertyCollection] = [];
          return;
        }

        const propertyName = $tableRow
          .children()
          .first()
          .text()
          .replace('_credit', '');
        const comment = $tableRow.find(':nth-child(2)').text();
        (resourceMeta[currentPropertyCollection] as Array<unknown>).push({
          propertyName,
          comment: replaceReservedWords(comment),
        });
      });

    resourceMetaCollection.push(resourceMeta as unknown as CodeComment);
  });

  return resourceMetaCollection;
}

/**
 * Inject property descriptions from comments into a JSON schema's definitions.
 */
export function injectComments(
  schema: Record<string, unknown>,
  comments: CodeComment[],
): Record<string, unknown> {
  const definitions = schema.definitions as Record<
    string,
    { properties?: Record<string, { description?: string }> }
  >;
  if (!definitions) return schema;

  for (const key of Object.keys(definitions)) {
    const propertyComments = comments.find((x) => x.title === toCamelCase(key));
    if (propertyComments) {
      const properties = definitions[key].properties;

      if (properties) {
        for (const property of Object.keys(properties)) {
          const found = propertyComments.fields?.find(
            (x) => x.propertyName === toSnakeCase(property),
          );
          if (found) {
            properties[property].description = found.comment;
          }
        }
      }
    }
  }

  return schema;
}
