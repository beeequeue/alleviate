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

const lru = createLRU({ max: 3 })

// set fresh values
lru.set("1", "foo")
lru.set("2", "bar")
lru.set("3", "biz")

lru.get("1") // "foo"

//
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

/* -- Further examples -- */

// 60 requests per minute
const limiter = new Limiter({
	concurrency: 16,
	pool: 60,
	refillInterval: 1000, // (default)
})

// 60 requests per minute, more spread out
const limiter = new Limiter({
	concurrency: 16,
	pool: 60,
	initial: 16,
	refill: 10,
	refillInterval: 10_000, // (default)
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
