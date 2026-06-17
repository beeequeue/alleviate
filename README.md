# alleviate

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/alleviate)](https://npmx.dev/package/alleviate)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/dependencies/alleviate)](https://npmx.dev/package/alleviate)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/size/alleviate)](https://npmx.dev/package/alleviate)

## Usage

### LRU

An ever so slightly modified version of [flru](https://github.com/lukeed/flru) by lukeed, the fastest and smallest LRU cache I've benchmarked.

> **Note**: It will keep store (and return) the last `max * 2` items in memory.
> When the cache reaches `max * 2 + 1` it will evict the current stale entries.

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

const response = await limiter.run(() => fetch("https://example.com"))

const callExample = limiter.wrap((path: string) => fetch(`https://example.com/${path}`))
await callExample("foo")

// If `timeout` is set, `.run()` will receive an AbortSignal.
const limiter = new Limiter({ timeout: 100 })
const response = await limiter.run((signal) => fetch("https://example.com", { signal }))

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
