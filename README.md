# alleviate

<!--
[![npm](https://img.shields.io/npm/v/alleviate)](https://www.npmjs.com/package/alleviate)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/alleviate)
![node-current](https://img.shields.io/node/v/alleviate)
-->

## Usage

### LRU

An ever so slightly modified version of [flru](https://github.com/lukeed/flru) by lukeed, the fastest and smallest LRU cache I've benchmarked.

> **Note**: It will keep store (and return) the last `max * 2` items in memory.
> When the cache reaches `max * 2 + 1` it will evict the last `max` stale entries.

```ts
import { createLRU } from "alleviate"

/* -- API -- */

const lru = createLRU({ max: 3 })

lru.set("foo", "bar")
lru.has("foo") // true
lru.get("foo") // "bar", marks "foo" as most recently used
lru.peek("foo") // "bar", does not affect LRU order

lru.setMany({
	biz: "baz",
	lorem: "ipsum",
})
lru.setMany([
	["0", "0"],
	["1", "1"],
	["2", "3"],
])

lru.clear()

/* -- How it works -- */

// set fresh values
lru.set("1", "foo")
lru.set("2", "bar")
lru.set("3", "biz")

// 1, 2, 3 are now cached
lru.get("1") // "foo"

// set 3 more.
lru.setMany({
	4: "4",
	5: "5",
	6: "6",
})

// 4, 5, 6 are now cached, 1, 2, 3 are still available but stale
lru.get("3") // "biz"
lru.get("6") // "6"

// set 1 more.
lru.set("7", "7")

// 7 is now cached. 4, 5, 6, are stale. 1, 2, 3 have been evicted.
lru.has("6") // true
lru.has("7") // true
lru.has("4") // false
```

### Limiter

```ts
import { Limiter } from "alleviate"

// Defaults
const limiter = new Limiter({
	concurrency: 4, // How many promises can be running at once
	pool: 4, // Max number of calls before blocking (defaults to `concurrency`)
	initial: 16, // How much the pool starts with (defaults to `pool`)
	refill: 60, // How much the pool increases per `refillInterval` (defaults to `pool`)
	refillInterval: 1000, // How often the pool is refilled in ms
	refillOverLimit: false, // Whether the pool should be refilled over its limit
	timeout: null, // How long to wait in ms for a call to resolve before rejecting
})

/* -- Examples -- */

// 60 requests per minute
const limiter = new Limiter({
	concurrency: 16,
	pool: 60,
})

// 60 requests per minute, more spread out
const limiter = new Limiter({
	concurrency: 16,
	pool: 60,
	initial: 16,
	refill: 10,
	refillInterval: 10_000,
})
```

### todo

- caching
  - [x] LRU
  - [ ] TTL Map
  - [ ] memoize
- limiting
  - [x] promise limiter
  - [ ] promise queue
