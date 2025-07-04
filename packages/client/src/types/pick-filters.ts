type KeysMatching<T, V> = {
  [K in keyof T]-?: T[K] extends V ? K : never;
}[keyof T];

type PickMatching<T, V> = Pick<T, KeysMatching<T, V>>;

export type PickFilters<T> = Partial<
  PickMatching<T, number> & PickMatching<T, string | null>
>;
