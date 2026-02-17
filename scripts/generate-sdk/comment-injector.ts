import * as cheerio from 'cheerio';
import pluralize from 'pluralize';
import { camelCase, snakeCase } from 'change-case';
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
    let title = '';
    const fields: CodeComment['fields'] = [];
    let currentSection = '';

    $(table)
      .children()
      .each((i, tableRow) => {
        const $tableRow = $(tableRow);

        // Extract the title from the first row
        const isTitleRow = i === 0;
        if (isTitleRow) {
          const rawTitle = replaceReservedWords(
            camelCase($tableRow.first().first().text().replace('URL: /', '')),
          );
          title = pluralize.isSingular(rawTitle)
            ? `${rawTitle}Details`
            : `${pluralize.singular(rawTitle)}ListItem`;
          return;
        }

        // Comic Vine docs: resource detail tables have 1-column header rows,
        // resource list tables have 3-column header rows
        const resourceHeaderRow = 1;
        const resourceListHeaderRow = 3;
        const isNewSection = [
          resourceHeaderRow,
          resourceListHeaderRow,
        ].includes($tableRow.children().length);
        if (isNewSection) {
          currentSection = camelCase($tableRow.children().first().text());
          return;
        }

        // Only collect property descriptions from the "fields" section,
        // not from "filters" (which describe query parameters)
        if (currentSection !== 'fields') return;

        const propertyName = $tableRow
          .children()
          .first()
          .text()
          .replace('_credit', '');
        const comment = $tableRow.find(':nth-child(2)').text();
        fields.push({
          propertyName,
          comment: replaceReservedWords(comment),
        });
      });

    resourceMetaCollection.push({ title, fields });
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
    const propertyComments = comments.find((x) => x.title === camelCase(key));
    if (propertyComments) {
      const properties = definitions[key].properties;

      if (properties) {
        for (const property of Object.keys(properties)) {
          const found = propertyComments.fields?.find(
            (x) => x.propertyName === snakeCase(property),
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
