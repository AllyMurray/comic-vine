# Comic Vine Library

The Comic Vine library provides convenient access to the [Comic Vine API](https://comicvine.gamespot.com/api) from
applications written in JavaScript/TypeScript. The API provides full access to the structured-wiki content.

## Comic Vine Resources

[Comic Vine resources list](https://comicvine.gamespot.com/api/documentation)

The library exposes an object for each Comic Vine resource, the object names are singular and expose a retrieve method that maps to the singular resource and a list method that maps to the plural resource.

The following table lists the resources that have been implemented and how the `retrieve` and `list` methods map to the API. Most resources are a direct mapping but `object` has been mapped to `thing`, this is due to `object` being a reserved word in JS and `thing` matches the Comic Vine wiki.

| Library resource object | Retrieve Method API Resource | List Method API Resource |
| ----------------------- | ---------------------------- | ------------------------ |
| character               | character                    | characters               |
| concept                 | concept                      | concepts                 |
| episode                 | episode                      | episodes                 |
| issue                   | issue                        | issues                   |
| location                | location                     | locations                |
| movie                   | movie                        | movies                   |
| origin                  | origin                       | origins                  |
| person                  | person                       | people                   |
| power                   | power                        | powers                   |
| promo                   | promo                        | promos                   |
| publisher               | publisher                    | publishers               |
| series                  | series                       | series_list              |
| storyArc                | story_arc                    | story_arcs               |
| team                    | team                         | teams                    |
| thing                   | object                       | object                   |
| video                   | video                        | videos                   |
| videoCategory           | video_category               | video_categories         |
| videoType               | video_type                   | video_types              |
| volume                  | volume                       | volumes                  |

## Installation

Install the package with:

```sh
npm install comic-vine
# or
yarn add comic-vine
```

## Usage/Examples

### Initialization

The package needs to be configured with your API key, [Grab an API key](https://comicvine.gamespot.com/api). Require it with the key's value:

```js
const comicVine = require('comic-vine')('your-api-key-here');

comicVine.publisher
  .retrieve({ id: 1859 })
  .then((customer) => console.log(customer.id))
  .catch((error) => console.error(error));
```

Or using ES modules and `async`/`await`:

```js
import ComicVine from 'comic-vine';
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
import ComicVine from 'comic-vine';
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
import ComicVine from 'comic-vine';
const comicVine = new ComicVine('your-api-key-here');

(async () => {
  try {
    const publishers = await comicVine.publisher.list();
    console.log(publisher.data);
  } catch (error) {
    console.error(error);
  }
})();
```

### Limit the fields in the response payload

When making a request it's likely that only certain properties are required. Both the retrieve and list methods accept options as the second parameter. This can be used to specify the field list.

When using TypeScript this is type safe, the return type is narrowed to the field list so that intellisense only displays the properties available in the response.

```js
import ComicVine from 'comic-vine';
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
import ComicVine from 'comic-vine';
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
