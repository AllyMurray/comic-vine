type digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
type oneToNine = Exclude<digit, 0>;

type YYYY = `19${digit}${digit}` | `20${digit}${digit}`;
type MM = `0${oneToNine}` | `1${0 | 1 | 2}`;
type DD = `${0}${oneToNine}` | `${1 | 2}${digit}` | `3${0 | 1}`;

export type IsoDate = `${YYYY}-${MM}-${DD}`;
