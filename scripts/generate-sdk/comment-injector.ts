import * as cheerio from 'cheerio';
import pluralize from 'pluralize';
import { camelCase, snakeCase } from 'change-case';
import type { CodeComment, InferredTypeGraph } from './types.js';

/** The Comic Vine API calls the "Thing" resource "object"; remap for the SDK. */
const mapApiNameToSdkName = (input: string): string => {
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
          const rawTitle = mapApiNameToSdkName(
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
          comment: mapApiNameToSdkName(comment),
        });
      });

    resourceMetaCollection.push({ title, fields });
  });

  return resourceMetaCollection;
}

/**
 * Apply property descriptions from comments to an InferredTypeGraph.
 * Sets the `description` field on matching PropertyInfo entries.
 */
export function applyComments(
  graph: InferredTypeGraph,
  comments: CodeComment[],
): void {
  // Match the root type against comments
  const rootComments = comments.find(
    (x) => x.title === camelCase(graph.rootType.name),
  );
  if (rootComments) {
    for (const prop of graph.rootType.properties) {
      // The HTML docs use e.g. "issue_credits" which is stored as "issues"
      // after _credit stripping (line 62). Apply the same normalisation to
      // the API property name so they match.
      const normalised = snakeCase(prop.name).replace('_credit', '');
      const found = rootComments.fields?.find(
        (x) => x.propertyName === normalised,
      );
      if (found) {
        prop.description = found.comment;
      }
    }
  }
}
