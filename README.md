# Comic Vine SDK

[![NPM Version](https://img.shields.io/npm/v/comic-vine-sdk)](https://www.npmjs.com/package/comic-vine-sdk)
[![License](https://img.shields.io/npm/l/comic-vine-sdk)](https://github.com/AllyMurray/comic-vine/blob/main/LICENSE)
[![Node.js Version](https://img.shields.io/node/v/comic-vine-sdk)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

The Comic Vine SDK provides convenient access to the [Comic Vine API][comic-vine-api] from applications written in JavaScript/TypeScript. The API provides full access to the structured-wiki content.

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Key Security](#api-key-security)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Roadmap](#roadmap)
- [Comic Vine Resources](#comic-vine-resources)
- [Usage/Examples](#usageexamples)
  - [Initialization](#initialization)
  - [Options](#options)
  - [Fetch a single resource](#fetch-a-single-resource)
  - [Fetch a resource list](#fetch-a-resource-list)
  - [Limit the fields in the response payload](#limit-the-fields-in-the-response-payload)
  - [Pagination](#pagination)
    - [Auto Pagination](#auto-pagination)
- [Run Locally](#run-locally)
- [Authors](#authors)

## Requirements

- Node.js 20.0.0 or higher
- npm, yarn, or pnpm

## Installation

Choose your preferred package manager:

**pnpm**

```sh
pnpm add comic-vine-sdk
```

**npm**

```sh
npm install comic-vine-sdk
```

**yarn**

```sh
yarn add comic-vine-sdk
```

## Quick Start

```js
import ComicVine from 'comic-vine-sdk';

// Initialize the client
const comicVine = new ComicVine('your-api-key-here');

// Fetch a single publisher
const publisher = await comicVine.publisher.retrieve(1859);
console.log(publisher.name);

// Fetch a list of issues
const issues = await comicVine.issue.list({ limit: 10 });
console.log(issues.data.map((issue) => issue.name));

// Fetch with field limiting
const limitedIssue = await comicVine.issue.retrieve(1234, {
  fieldList: ['id', 'name', 'description'],
});
console.log(limitedIssue.name);
```

## API Key Security

⚠️ **Important**: Never expose your API key in client-side code or commit it to version control.

### Environment Variables (Recommended)

**Create a .env file:**

```bash
# .env file
COMIC_VINE_API_KEY=your-api-key-here
```

**Use in your application:**

```js
import ComicVine from 'comic-vine-sdk';

const comicVine = new ComicVine(process.env.COMIC_VINE_API_KEY);
```

### Browser Usage

The Comic Vine API doesn't support CORS. For browser usage, you'll need:

- A backend proxy to make API calls
- Server-side API key storage (never send keys to the browser)

**Example proxy setup:**

```js
// Backend API route (Express.js example)
app.get('/api/comic-vine/publisher/:id', async (req, res) => {
  try {
    const comicVine = new ComicVine(process.env.COMIC_VINE_API_KEY);
    const publisher = await comicVine.publisher.retrieve(req.params.id);
    res.json(publisher);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## TypeScript Typings

There's a good chance you may find an issue with the typings in the API response objects. They were generated using sample data from the API, if you find a problem [open an issue](https://github.com/AllyMurray/comic-vine/issues/new) detailing the problem along with the request details so I can add that request to the sample dataset. While you wait for it to be fixed add `// @ts-expect-error` above the line causing the problem. This will allow you to compile in the meantime but will flag when the problem has been fixed.

## Rate Limiting

The Comic Vine API implements rate limiting to ensure fair usage and API health for all users.

> ⚠️ **Note**: This library will soon include built-in solutions for caching, request deduplication, and rate limiting. The examples below are temporary workarounds until these features are available.

### Limits

- **200 requests per resource per hour** - Official limit per user
- **Velocity detection** - Prevents too many requests per second
- **Temporary blocks** - May occur if limits are exceeded

### Best Practices

**Cache responses** to avoid duplicate requests:

```js
// Example: Simple in-memory cache
const cache = new Map();

async function getCachedPublisher(id) {
  const cacheKey = `publisher-${id}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const publisher = await comicVine.publisher.retrieve(id);
  cache.set(cacheKey, publisher);

  return publisher;
}
```

**Implement delays** between requests:

```js
// Example: Add delay between requests
async function fetchMultipleIssues(ids) {
  const issues = [];

  for (const id of ids) {
    const issue = await comicVine.issue.retrieve(id);
    issues.push(issue);

    // Wait 100ms between requests
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return issues;
}
```

**Use pagination wisely**:

```js
// Instead of making many small requests
const issues = await comicVine.issue.list({ limit: 100 }); // Better
// Rather than
const issues = await comicVine.issue.list({ limit: 10 }); // Less efficient
```

## Error Handling

The Comic Vine SDK provides specific error types to help you handle different failure scenarios gracefully.

### Error Types

All errors extend the base `BaseError` class and include:

- `message`: Human-readable error description
- `help`: Guidance on how to resolve the issue

**Common Error Types:**

| Error Type                     | When It Occurs          | How to Handle                    |
| ------------------------------ | ----------------------- | -------------------------------- |
| `ComicVineUnauthorizedError`   | Invalid API key         | Check your API key               |
| `ComicVineObjectNotFoundError` | Resource doesn't exist  | Verify the resource ID           |
| `OptionsValidationError`       | Invalid request options | Check your parameters            |
| `ComicVineGenericRequestError` | API request failed      | Retry or check API status        |
| `ComicVineSubscriberOnlyError` | Premium content access  | Requires Comic Vine subscription |

### Basic Error Handling

**Simple try-catch:**

```js
import ComicVine from 'comic-vine-sdk';

const comicVine = new ComicVine('your-api-key-here');

try {
  const publisher = await comicVine.publisher.retrieve(999999);
  console.log(publisher.name);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Help:', error.help);
}
```

### Specific Error Handling

**Handle different error types:**

```js
import ComicVine, {
  ComicVineUnauthorizedError,
  ComicVineObjectNotFoundError,
  OptionsValidationError,
} from 'comic-vine-sdk';

const comicVine = new ComicVine('your-api-key-here');

try {
  const issue = await comicVine.issue.retrieve(999999);
} catch (error) {
  if (error instanceof ComicVineUnauthorizedError) {
    console.error(
      'Invalid API key. Get one from: https://comicvine.gamespot.com/api/',
    );
  } else if (error instanceof ComicVineObjectNotFoundError) {
    console.error('Issue not found. Please check the ID.');
  } else if (error instanceof OptionsValidationError) {
    console.error('Invalid request parameters:', error.message);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Robust Error Handling with Retry

**Implement retry logic for transient errors:**

```js
async function fetchWithRetry(fetchFn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      // Don't retry on client errors
      if (
        error instanceof ComicVineUnauthorizedError ||
        error instanceof ComicVineObjectNotFoundError ||
        error instanceof OptionsValidationError
      ) {
        throw error;
      }

      // Retry on server errors
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

// Usage
try {
  const publisher = await fetchWithRetry(() =>
    comicVine.publisher.retrieve(1859),
  );
  console.log(publisher.name);
} catch (error) {
  console.error('Failed after retries:', error.message);
}
```

### Error Handling in Lists

**Handle errors when processing multiple items:**

```js
async function fetchMultipleIssues(ids) {
  const results = [];
  const errors = [];

  for (const id of ids) {
    try {
      const issue = await comicVine.issue.retrieve(id);
      results.push({ id, issue });
    } catch (error) {
      errors.push({ id, error: error.message });
    }
  }

  return { results, errors };
}

// Usage
const { results, errors } = await fetchMultipleIssues([1, 2, 999999]);
console.log(`Successfully fetched: ${results.length}`);
console.log(`Errors: ${errors.length}`);
```

## Advanced Usage

### Available Filters

Common filter options for list methods:

**Filter by name:**

```js
const issues = await comicVine.issue.list({
  filter: { name: 'The Boys' },
});
```

**Filter by date range:**

```js
const recentIssues = await comicVine.issue.list({
  filter: {
    date_added: '2024-01-01 00:00:00|2024-12-31 23:59:59',
  },
});
```

**Multiple filters:**

```js
const filteredIssues = await comicVine.issue.list({
  filter: {
    name: 'Spider-Man',
    date_added: '2024-01-01 00:00:00|2024-12-31 23:59:59',
  },
});
```

**Publisher-specific content:**

```js
const marvelIssues = await comicVine.issue.list({
  filter: {
    publisher: 'Marvel Comics',
  },
  limit: 50,
});
```

### Common Field Lists

**Minimal issue data:**

```js
const lightIssue = await comicVine.issue.retrieve(1234, {
  fieldList: ['id', 'name', 'issue_number'],
});
```

**Full issue details:**

```js
const fullIssue = await comicVine.issue.retrieve(1234, {
  fieldList: ['id', 'name', 'description', 'cover_date', 'image', 'volume'],
});
```

**Character essentials:**

```js
const character = await comicVine.character.retrieve(1234, {
  fieldList: ['id', 'name', 'description', 'image', 'publisher', 'powers'],
});
```

**Publisher overview:**

```js
const publisher = await comicVine.publisher.retrieve(1234, {
  fieldList: [
    'id',
    'name',
    'description',
    'image',
    'date_added',
    'location_city',
  ],
});
```

### Sorting and Ordering

**Sort by date (newest first):**

```js
const recentIssues = await comicVine.issue.list({
  sort: 'date_added:desc',
  limit: 10,
});
```

**Sort by name:**

```js
const sortedCharacters = await comicVine.character.list({
  sort: 'name:asc',
  limit: 100,
});
```

### Complex Queries

**Combine multiple options:**

```js
const complexQuery = await comicVine.issue.list({
  filter: {
    name: 'Spider-Man',
    date_added: '2024-01-01 00:00:00|2024-12-31 23:59:59',
  },
  fieldList: ['id', 'name', 'issue_number', 'cover_date', 'image'],
  sort: 'cover_date:desc',
  limit: 25,
  offset: 0,
});
```

## Roadmap

- Expandable responses

- Cached responses

- Rate limiting

## Comic Vine Resources

[Comic Vine resources list][comic-vine-docs]

The library exposes an object for each Comic Vine resource, the object names are singular and expose a retrieve method that maps to the singular resource and a list method that maps to the plural resource.

The following table lists the resources that have been implemented and how the `retrieve` and `list` methods map to the API. Most resources are a direct mapping but `object` has been mapped to `thing`, this is due to `object` being a reserved word in JS and `thing` matches the Comic Vine wiki.

| Library resource object | Retrieve Method API Resource          | List Method API Resource                  |
| ----------------------- | ------------------------------------- | ----------------------------------------- |
| character               | [character][character-docs]           | [characters][characters-docs]             |
| concept                 | [concept][concept-docs]               | [concepts][concepts-docs]                 |
| episode                 | [episode][episode-docs]               | [episodes][episodes-docs]                 |
| issue                   | [issue][issue-docs]                   | [issues][issues-docs]                     |
| location                | [location][location-docs]             | [locations][locations-docs]               |
| movie                   | [movie][movie-docs]                   | [movies][movies-docs]                     |
| origin                  | [origin][origin-docs]                 | [origins][origins-docs]                   |
| person                  | [person][person-docs]                 | [people][people-docs]                     |
| power                   | [power][power-docs]                   | [powers][powers-docs]                     |
| promo                   | [promo][promo-docs]                   | [promos][promos-docs]                     |
| publisher               | [publisher][publisher-docs]           | [publishers][publishers-docs]             |
| series                  | [series][series-docs]                 | [series_list][series-list-docs]           |
| storyArc                | [story_arc][story-arc-docs]           | [story_arcs][story-arcs-docs]             |
| team                    | [team][team-docs]                     | [teams][teams-docs]                       |
| thing                   | [object][object-docs]                 | [objects][objects-docs]                   |
| video                   | [video][video-docs]                   | [videos][videos-docs]                     |
| videoCategory           | [video_category][video-category-docs] | [video_categories][video-categories-docs] |
| videoType               | [video_type][video-type-docs]         | [video_types][video-types-docs]           |
| volume                  | [volume][volume-docs]                 | [volumes][volumes-docs]                   |

## Usage/Examples

### Initialization

The package needs to be configured with your API key, [Grab an API key][comic-vine-api]. Require it with the key's value:

```js
const ComicVine = require('comic-vine-sdk');
const comicVine = new ComicVine('your-api-key-here');

comicVine.publisher
  .retrieve(1859)
  .then((publisher) => console.log(publisher.id))
  .catch((error) => console.error(error));
```

Or using ES modules and `async`/`await`:

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const publisher = await comicVine.publisher.retrieve(1859);
    console.log(publisher.name);
  } catch (error) {
    console.error(error);
  }
})();
```

### Options

The second parameter of the constructor accepts options to configure the library

```js
new ComicVine('your-api-key-here', options);
```

### `baseUrl`

**Type: <code>string | undefined</code>**

**Default: https://comicvine.gamespot.com/api/**

If using this package in node this should not need set, the default value will work.

If using the package in a web browser then The Comic Vine API does not allow [cross-origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) requests. This option could be used to proxy the request assuming you have some safe way for the web client to fetch your api key, you don't want to send the api key to the browser in your JS bundle.

```js
import ComicVine from 'comic-vine-sdk';

// This is just an example, to try it out you would
// have to visit (https://cors-anywhere.herokuapp.com)
// to request temporary access.
const comicVine = new ComicVine('your-api-key-here', {
  baseUrl: 'https://cors-anywhere.herokuapp.com/https://www.comicvine.com/api/',
});

(async () => {
  try {
    const publisher = await comicVine.publisher.retrieve(1859);
    console.log(publisher.name);
  } catch (error) {
    console.error(error);
  }
})();
```

### Fetch a single resource

All resources have a retrieve method, the following example retrieves a publisher

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const publisher = await comicVine.publisher.retrieve(1859);
    console.log(publisher.name);
  } catch (error) {
    console.error(error);
  }
})();
```

### Fetch a resource list

All resources have a list method, the following example retrieves a list of publishers

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const publishers = await comicVine.publisher.list();
    console.log(publishers.data);
  } catch (error) {
    console.error(error);
  }
})();
```

### Limit the fields in the response payload

When making a request it's likely that only certain properties are required. Both the retrieve and list methods accept options as the second parameter. This can be used to specify the field list.

When using TypeScript this is type safe, the return type is narrowed to the field list so that intellisense only displays the properties available in the response.

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const issue = await comicVine.issue.retrieve(1234, {
      fieldList: ['id', 'name', 'description'],
    });

    // The id property is in the fieldList and will be available
    console.log(issue.id);

    // In JS dateAdded will be undefined at runtime
    // in TS the compiler will produce an error because it wasn't in the fieldList
    console.log(issue.dateAdded);

    // An object containing the id, name and description properties
    console.log(issue);
  } catch (error) {
    console.error(error);
  }
})();
```

### Pagination

The Comic Vine API provides offset based pagination, this is done by providing a `limit` and `offset` in the request. The `limit` is the number of items to be returned in one page and the offset is the number of items to skip.

To fetch a page with 50 results and then move to the next page:

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const limit = 50;
    const filter = { name: 'The Boys' };

    // Retrieve the first 50 issues of The Boys (Page 1)
    const issuesPage1 = await comicVine.issue.list({ limit, filter });
    console.log(`Total issues: ${issuesPage1.data.length}`);
    console.log(issuesPage1.data.map((issue) => issue.name).join(', '));

    // Retrieve the next 50 issues of The Boys (Page 2)
    const issuesPage2 = await comicVine.issue.list({
      limit,
      filter,
      offset: 50,
    });
    console.log(`Total issues: ${issuesPage2.data.length}`);
    console.log(issuesPage2.data.map((issue) => issue.name).join(', '));
  } catch (error) {
    console.error(error);
  }
})();
```

#### Auto Pagination

This feature allows calling any list method on a resource with `for await...of` rather than having to track the offset for making subsequent requests.

It will make the first request and return an item from that response on each iteration, when there are no more items to return it will automatically fetch the next page from the API. This will continue until all pages have been retrieved.

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const listOptions = {
      filter: { name: 'The Boys' },
      limit: 50,
    };

    let issueNames = [];
    for await (const issue of comicVine.issue.list(listOptions)) {
      issueNames.push(issue.name);
    }

    console.log(`Total issues: ${issueNames.length}`);
    console.log(issueNames);
  } catch (error) {
    console.error(error);
  }
})();
```

## Run Locally

Clone the project

```bash
  git clone https://github.com/AllyMurray/comic-vine.git
```

Go to the project directory

```bash
  cd comic-vine
```

Install dependencies

```bash
  npm install
```

Run the tests

```bash
  npm run test
```

## Authors

- [@AllyMurray](https://github.com/AllyMurray)

[comic-vine-api]: https://comicvine.gamespot.com/api
[comic-vine-docs]: https://comicvine.gamespot.com/api/documentation
[character-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-2
[characters-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-3
[concept-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-6
[concepts-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-7
[episode-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-8
[episodes-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-9
[issue-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-10
[issues-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-11
[location-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-12
[locations-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-13
[movie-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-14
[movies-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-15
[object-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-16
[objects-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-17
[origin-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-18
[origins-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-19
[person-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-20
[people-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-21
[power-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-22
[powers-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-23
[promo-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-24
[promos-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-25
[publisher-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-26
[publishers-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-27
[series-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-28
[series-list-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-29
[story-arc-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-31
[story-arcs-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-32
[team-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-33
[teams-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-34
[video-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-36
[videos-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-37
[video-type-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-38
[video-types-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-39
[video-category-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-40
[video-categories-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-41
[volume-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-42
[volumes-docs]: https://comicvine.gamespot.com/api/documentation#toc-0-43
