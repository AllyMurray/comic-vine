// Compile the published entry point with TS6 and TS7, independently of tsd's compiler.
import ComicVine, {
  ComicVine as ComicVineNamed,
  ComicVineUnauthorizedError,
  StatusCode,
  type ComicVineOptions,
  type Response,
} from 'comic-vine-sdk';

function accepts<T>(_value: T): void {}

const options = { apiKey: 'test-key' } satisfies ComicVineOptions;
const client: ComicVineNamed = new ComicVine(options);
const list = client.character.list();
accepts<PromiseLike<unknown>>(list);
accepts<AsyncIterable<unknown>>(list);
accepts<Promise<unknown>>(client.character.retrieve(1));
accepts<Error>(new ComicVineUnauthorizedError());
accepts<string>(new ComicVineUnauthorizedError().help);

declare const response: Response<string>;
accepts<string>(response.results);
accepts<StatusCode>(response.statusCode);
accepts<'OK'>(response.error);

// @ts-expect-error Consumers must supply an API key.
new ComicVine({});
// @ts-expect-error API keys must be strings.
new ComicVine({ apiKey: 123 });
// @ts-expect-error Resource IDs must be numeric.
client.character.retrieve('invalid');
