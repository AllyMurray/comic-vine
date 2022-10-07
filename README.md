# Comic Vine SDK

The Comic Vine SDK provides convenient access to the [Comic Vine API][comic-vine-api] from server side applications written in JavaScript/TypeScript. The API provides full access to the structured-wiki content.

## Table of Contents

- [Installation](#installation)
- [Browser Support](#browser-support)
- [Roadmap](#roadmap)
- [Comic Vine Resources](#comic-vine-resources)
- [Usage/Examples](#usageexamples)
  - [Initialization](#initialization)
  - [Fetch a single resource](#fetch-a-single-resource)
  - [Fetch a resource list](#fetch-a-resource-list)
  - [Limit the fields in the response payload](#limit-the-fields-in-the-response-payload)
  - [Pagination](#pagination)
- [Run Locally](#run-locally)
- [Authors](#authors)

## Installation

Install the package with:

```sh
npm install comic-vine-sdk
# or
yarn add comic-vine-sdk
```

## Browser support

This package does not currently work in a web browser, the Comic Vine API does not allow [cross-origin](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS) requests. The recommended approach would be to use it server side, however, in a future update an option to set the baseUrl will be added. This option could be used to proxy the request assuming you have some safe way for the web client to fetch your api key, you don't want to send the api key to the browser in your JS bundle.

## Roadmap

- Add option to set baseUrl when initializing the library

- Automatic Pagination

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

The Comic Vine API supports pagination, this library currently just exposes the properties returned by the API. In a future version this will be updated to make pagination easier to use.

The following example fetches all volumes of the Boys with 20 items per page, it will continue making requests until all results are retrieved.

```js
import ComicVine from 'comic-vine-sdk';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const limit = 20;
    const volumes = [];
    let hasMoreResults = true;
    let pageNumber = 0;
    do {
      pageNumber++;
      const page = await comicVine.volume.list({
        filter: { name: 'The Boys' },
        limit,
        offset: limit * pageNumber - limit,
      });
      volumes.push(...page.data);
      hasMoreResults = volumes.length < page.numberOfTotalResults;
    } while (hasMoreResults);

    console.log(`Number of requests made to Comic Vine: ${pageNumber}`); // 2
    console.log(`Total volumes: ${volumes.length}`); // 35
    console.log(volumes); // An array of volume objects
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
