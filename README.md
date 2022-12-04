# Comic Vine SDK

The Comic Vine SDK provides convenient access to the [Comic Vine API][comic-vine-api] from applications written in JavaScript/TypeScript. The API provides full access to the structured-wiki content.

## Table of Contents

- [Installation](#installation)
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

## Installation

Install the package with:

```sh
npm install comic-vine-sdk
# or
yarn add comic-vine-sdk
```

## TypeScript Typings

There's a good change you may find an issue with the typings in the API response objects. They were generated using sample data from the API, if you find a problem [open an issue](https://github.com/AllyMurray/comic-vine/issues/new) detailing the problem along with the request details so I can add that request to the sample dataset. While you wait for it to be fixed add `// @ts-expect-error` above the line causing the problem. This will allow you to compile in the meantime but will flag when the problem has been fixed.

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
  .then((customer) => console.log(customer.id))
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

All resources have a retrieve method, the following example retrieves a list of publishers

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
    const issue = await comicVine.issue.retrieve(id, {
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

To fetch a page with 50 results and then move to hte next page:

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const limit: 50;
    const filter: { name: 'The Boys' },

    // Retrieve the first 50 issues of The Boys (Page 1)
    const issuesPage1 = await comicVine.issue.list({ limit, filter });
    console.log(`Total issues: ${issuesPage1.data.length}`);
    console.log(issuesPage1.data.map(issue => issue.name).join(', '));

    // Retrieve the next 50 issues of The Boys (Page 2)
    const issuesPage2 = await comicVine.issue.list({ limit, filter, offset: 50 });
    console.log(`Total issues: ${issuesPage2.data.length}`);
    console.log(issuesPage2.data.map(issue => issue.name).join(', '));
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
      issueName.push(issue.name);
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
