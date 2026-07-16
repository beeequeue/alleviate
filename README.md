# alleviate

[![Open on npmx.dev](https://npmx.dev/api/registry/badge/version/alleviate)](https://npmx.dev/package/alleviate)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/dependencies/alleviate)](https://npmx.dev/package/alleviate)
[![Open on npmx.dev](https://npmx.dev/api/registry/badge/size/alleviate)](https://npmx.dev/package/alleviate)

## Usage

- [createLRU](#lru) - A simple, fast LRU cache.
- [createTTLMap](#ttl-map) - A more complex promise queue/limiter. Supports more advanced rate limiting than `Queue`.
- [memoize](#memoize) - Memoize a function, i.e. cache its results based on its parameters to skip re-computation.
- [createQueue](#queue) - A simple FIFO promise queue.
- [createLimiter](#limiter) - A more complex promise queue/limiter. Supports more advanced rate limiting than `Queue`.

### LRU

An ever so slightly modified version of [flru](https://github.com/lukeed/flru) by lukeed, the fastest and smallest LRU cache I've benchmarked.

> **Note**: It will keep store (and return) the last `max * 2` items in memory.
> When the cache reaches `max * 2 + 1` it will evict the current stale entries.

```ts
import { createLRU } from "alleviate"

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

<!-- REMOVE START -->

<details>

<summary>Comparisons</summary>

_updated 2026-06-22. [benches](https://github.com/beeequeue/node-benches/tree/main/benches/lru) ran on a Ryzen 9800X3D_

| library     | install size   | bundle size   | get 10 000 items  | set 10 000 items  | set+evict 10 000 items |
| ----------- | -------------- | ------------- | ----------------- | ----------------- | ---------------------- |
| `alleviate` | 22kB           | 514b          | 231.96 µs         | 457.33 µs         | 1.19 ms                |
| `flru`      | 8.9kB (-41%)   | 373b (~same)  | 303.74 µs (~same) | 510.42 µs (~same) | 1.21 ms (~same)        |
| `tiny-lru`  | 57.0kB (+259%) | 10kB (+1957%) | 379.05 µs (~same) | 573.41 µs (~same) | 1.32 ms (~same)        |
| `lru-cache` | 2.7MB (x123!)  | 37kB (+7214%) | 1.18 ms (+510%)   | 2.04 ms (+446%)   | 3.01 ms (+252%)        |

| library     | get | has | peek | set | delete | 🕐 TTL |
| ----------- | --- | --- | ---- | --- | ------ | ------ |
| `alleviate` | ✅  | ✅  | ✅   | ✅  | ✅     | ❌     |
| `flru`      | ✅  | ✅  | ❌   | ✅  | ❌     | ❌     |
| `tiny-lru`  | ✅  | ✅  | ✅   | ✅  | ✅     | ✅     |
| `lru-cache` | ✅  | ✅  | ✅   | ✅  | ✅     | ✅     |

</details>

<!-- REMOVE END -->

### TTL Map

A simple TTL Map that evicts entries after a given expiration time.

```ts
import { createTTLMap } from "alleviate"

const cache = createTTLMap({ ttl: 60_000 })

cache.set("foo", "bar")
cache.has("foo") // true, does not affect TTL
cache.get("foo") // "bar", refreshes TTL unless `getRefreshesTTL` is false
cache.peek("foo") // "bar", does not affect TTL
cache.clear()
```

### Memoize

Memoize a function, i.e. cache its results based on its parameters to skip re-computation.

```ts
import { memoize } from "alleviate"

const fibonacci = memoize((num: number) => {
	/* ... */
})
fibonacci(100)
fibonacci(100) // skips executing function, returns cached result

const memoized = memoize(fn, {
	max: 100, // number of cached results to keep before evicting the oldest
	keepNullish: true, // whether to cache nullish results (null, undefined). Defaults to `false`.
	serialize: (params) => {}, // custom parameter serialization for the cache key. Defaults to `object-identity` + sha256 hashing.
})
```

### Queue

An intentionally simple promise queue that only accepts a `concurrency` option.

For more advanced promise limiting (timeouts, pools, etc.), see [`Limiter`](#limiter).

```ts
import { createQueue } from "alleviate"

const queue = createQueue({ concurrency: 4 })

// run a function asap
const response = await queue.run(() => fetch("https://example.com"))

// wrap a function to run it later, or multiple times
const callExample = queue.wrap((path: string) => fetch(`https://example.com/${path}`))
await callExample("foo")
```

### Limiter

Intended as a replacement for [`bottleneck`](https://npmx.dev/bottleneck), [`p-queue`](https://npmx.dev/p-queue).

```ts
import { createLimiter } from "alleviate"

const limiter = createLimiter({
	concurrency: 4, // How many promises can be running at once (defaults to 3/4ths of available threads)
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
const limiter = createLimiter({ timeout: 100 })
const response = await limiter.run((signal) => fetch("https://example.com", { signal }))

/* -- Examples -- */

// 60 requests per minute
const limiter = createLimiter({
	concurrency: 16,
	pool: 60,
	refillInterval: 60_000,
})

// 60 requests per minute, more spread out
const limiter = createLimiter({
	concurrency: 16,
	pool: 60,
	initial: 16,
	refill: 10,
	refillInterval: 10_000,
})
```

<!-- REMOVE START -->

<details>

<summary>Comparisons</summary>

_updated 2026-06-22_

| library      | install size   | bundle size   | external sync (e.g. redis) | reservoir-style limiting |
| ------------ | -------------- | ------------- | -------------------------- | ------------------------ |
| `alleviate`  | 22kB           | 1.1kB         | ❌                         | ✅                       |
| `p-queue`    | 171kB (+777%)  | 12kB (+1091%) | ❌                         | ❌                       |
| `bottleneck` | 629kB (+2859%) | 61kb (+5545%) | ✅                         | ✅                       |

</details>

<!-- REMOVE END -->

<!-- REMOVE START -->

### todo

- caching
  - [x] LRU
  - [x] TTL Map
  - [x] memoize
- limiting
  - [x] promise limiter
    - [ ] change impl to remove interval, use last-run-timestamp instead
    - [ ] support changing concurrency
    - [ ] support changing reservoir level
    - [ ] add example for complex rate limiting handling based on returned info from API
  - [x] promise queue
