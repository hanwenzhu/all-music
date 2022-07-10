export interface Enumerable<T> {
  count?: bigint;
  entropy: number;
  encode(x: T): bigint;
  decode(n: bigint): T;
  encodeTo(x: T, n: bigint): bigint;
  decodeFrom(n: bigint): [T, bigint];
}

abstract class BaseEnumerable<T> implements Enumerable<T> {
  count?: bigint;
  entropy: number;
  encode(x: T): bigint {
    return this.encodeTo(x, 0n);
  };
  decode(n: bigint): T {
    const [x, r] = this.decodeFrom(n);
    if (r)
      console.warn('Decoded non-terminal.');
    return x;
  };
  encodeTo(x: T, n: bigint): bigint {
    if (this.count == null)
      console.warn('Default encodeTo encountered undefined count.')
    return n * this.count + this.encode(x);
  };
  decodeFrom(n: bigint): [T, bigint] {
    if (this.count == null)
      console.warn('Default decodeFrom encountered undefined count.')
    return [this.decode(n % this.count), n / this.count];
  };
}

export class Enum extends BaseEnumerable<number> {
  count: bigint;
  entropy: number;
  constructor(enumObject: { count: number }) {
    super();
    this.count = BigInt(enumObject.count);
    this.entropy = Math.log(enumObject.count);
  }
  encode(m: number): bigint {
    return BigInt(m);
  }
  decode(n: bigint): number {
    return Number(n);
  }
}

/**
 * Enumerates the lists of T
 */
export class List<T> extends BaseEnumerable<T[]> {
  entropy: number;

  enumerable: Enumerable<T>;
  topLevel: boolean;

  /**
   * @param enumerable Enumerable object for each element
   * @param expectedLength Expected length for the list (for entropy estimation)
   * @param topLevel Whether decoding should consume entire code
   */
  constructor(enumerable: Enumerable<T>, expectedLength: bigint | number, topLevel: boolean = false) {
    super();
    this.entropy = (1 + enumerable.entropy) * Number(expectedLength);
    this.enumerable = enumerable;
    this.topLevel = topLevel;
  }

  encodeTo(values: T[], n: bigint): bigint {
    // big endian is more intuitive for sequences
    if (!this.topLevel) {
      // nil = 0
      n *= 2n;
    }
    for (let i = values.length - 1; i >= 0; i--) {
      n = this.enumerable.encodeTo(values[i], n);
      if (!this.topLevel) {
        // cons = 1
        n *= 2n;
        n++;
      }
    }
    return n;
  }

  decodeFrom(n: bigint): [T[], bigint] {
    const values: T[] = [];
    while (this.topLevel && n > 0n || !this.topLevel && n % 2n == 1n) {
      if (!this.topLevel) n /= 2n;
      const [x, m] = this.enumerable.decodeFrom(n);
      values.push(x);
      n = m;
    }
    if (!this.topLevel) n /= 2n;
    return [values, n];
  }
}

// /**
//  * Enumerates the power set of T.
//  * 
//  * Note that encode and decode have linear complexity.
//  */
// export class Choose<T> implements Enumerable<T[]> {
//   count: bigint;
//   entropy: number;

//   enumerable: Enumerable<T>;
//   length: bigint;

//   private static choose(n: bigint, k: bigint): bigint {
//     let count = 1n;
//     for (let i = 0n; i < k; i++)
//       count *= n - i;
//     for (let i = k; i > 0; i--)
//       count /= i;
//     return count;
//   }

//   constructor(enumerable: Enumerable<T>, length: bigint) {
//     this.count = Choose.choose(enumerable.count, length);
//     // entropy requires more assumptions; empty for now
//     this.entropy = NaN;
//     this.enumerable = enumerable;
//     this.length = length;
//   }

//   // index of a combination, linear in this.enumerable.count
//   encode(values: T[]): bigint {
//     const combination = values.map(this.enumerable.encode);
//     combination.sort((x, y) => Number(x - y));
//     let m = 0n;
//     let n = 0n;
//     for (let j = 0; j < combination.length; j++) {
//       while (m < combination[j]) {
//         m++;
//         n += Choose.choose(this.enumerable.count - m,
//                            this.length - BigInt(j + 1));
//       }
//       m++;
//     }
//     return n;
//   }

//   // ith combination, linear in this.enumerable.count
//   decode(n: bigint): T[] {
//     let combination = new Array<bigint>(Number(this.length));
//     let p = 0n;
//     let m = 0n;
//     for (let j = 0; j < this.length - 1n; j++) {
//       let r: bigint;
//       do {
//         m++;
//         r = Choose.choose(this.enumerable.count - m,
//                           this.length - BigInt(j + 1));
//         p += r;
//       } while (p < n + 1n);
//       p -= r;
//       combination[j] = m - 1n;
//     }
//     combination[Number(this.length - 1n)] =
//       combination[Number(this.length - 2n)] + n + 1n - p;
//     return combination.map(this.enumerable.decode);
//   }
// }

// [Enumerable<S> for S in T]
type TupleEnumerable<T extends any[]> = {
  [I in keyof T]: I extends number ? Enumerable<T[I]> : never;
} & Enumerable<T[keyof T]>[];

/**
 * Enumerates Cartesian product of types.
 */
export class Tuple<T extends any[]> extends BaseEnumerable<T> {
  count?: bigint;
  entropy: number;

  enumerables: TupleEnumerable<T>;

  constructor(enumerables: TupleEnumerable<T>) {
    super();
    if (enumerables.every(e => e.count != null))
      this.count = enumerables.map(e => e.count).reduce((m, n) => m * n);
    this.entropy = enumerables.map(e => e.entropy).reduce((h, g) => h + g);
    this.enumerables = enumerables;
  }

  encodeTo(tuple: T, n: bigint): bigint {
    // little-endian encoding
    for (let i = 0; i < tuple.length; i++) {
      n = this.enumerables[i].encodeTo(tuple[i], n);
    }
    return n;
  }

  decodeFrom(n: bigint): [T, bigint] {
    const values = [];
    const enumerables = [...this.enumerables].reverse()
    for (const e of enumerables) {
      const [x, m] = e.decodeFrom(n);
      values.unshift(x);
      n = m;
    }
    return [values as T, n];
  }
}

// { key: Enumerable<T[key]> for key in K }
type MapEnumerable<T> = {
  [K in keyof T]: Enumerable<T[K]>
};

type Values<T> = T[keyof T][];

/**
 * Enumerates named Cartesian product of types.
 */
export class Struct<T> extends BaseEnumerable<T> {
  count?: bigint;
  entropy: number;

  keys: (keyof T)[];
  tupleEnumerable: Tuple<Values<T>>;

  constructor(namedEnumerables: MapEnumerable<T>, keys?: (keyof T)[]) {
    super();
    keys = keys || Object.keys(namedEnumerables) as (keyof T)[];
    const enumerables = Object.values(namedEnumerables) as TupleEnumerable<Values<T>>;
    this.tupleEnumerable = new Tuple<Values<T>>(enumerables);
    this.keys = keys;
    this.count = this.tupleEnumerable.count;
    this.entropy = this.tupleEnumerable.entropy;
  }

  encodeTo(struct: T, n: bigint): bigint {
    const tuple = this.keys.map(key => struct[key]);
    return this.tupleEnumerable.encodeTo(tuple, n);
  }

  decodeFrom(n: bigint): [T, bigint] {
    const [tuple, m] = this.tupleEnumerable.decodeFrom(n);
    const struct = Object.fromEntries(
      tuple.map((value, i) => [this.keys[i], value])
    ) as {
      [K in keyof T]: T[K];
    };
    return [struct, m];
  }
}

/**
 * Enumerates the union of T and S
 */
export class Either<T, S> extends BaseEnumerable<T | S> {
  count?: bigint;
  entropy: number;

  enumerable1: Enumerable<T>;
  enumerable2: Enumerable<S>;
  isT: (x: T | S) => x is T;

  constructor(enumerable1: Enumerable<T>, enumerable2: Enumerable<S>,
              isT: (x: T | S) => x is T, p: number = 0.5) {
    super();
    if (enumerable1.count != null && enumerable2.count != null)
      this.count = enumerable1.count + enumerable2.count;
    this.entropy = 1 + p * enumerable1.entropy + (1 - p) * enumerable2.entropy;
    this.enumerable1 = enumerable1;
    this.enumerable2 = enumerable2;
  }

  encodeTo(x: T | S, n: bigint): bigint {
    if (this.isT(x)) {
      n = this.enumerable1.encodeTo(x, n);
      n *= 2n;
    } else {
      n = this.enumerable2.encodeTo(x, n);
      n *= 2n;
      n++;
    }
    return n;
  }

  decodeFrom(n: bigint): [T | S, bigint] {
    const choice = n % 2n;
    n /= 2n;
    return choice === 0n ?
      this.enumerable1.decodeFrom(n) :
      this.enumerable2.decodeFrom(n);
  }
}

export function equals<T>(x: T, y: T): boolean {
  if (Array.isArray(x) && Array.isArray(y))
    return x.length === y.length && x.every((_, i) => equals(x[i], y[i]));
  else if (typeof x === typeof y && typeof x === 'object')
    return equals(Object.entries(x), Object.entries(y));
  else
    return x === y;
}
