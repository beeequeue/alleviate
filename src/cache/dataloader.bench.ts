// oxlint-disable vitest/expect-expect

import { createDataLoader } from "alleviate"
import DataLoader from "dataloader"
import { factory } from "dldr/cache"
import { bench, describe } from "vitest"

async function fn(keys: readonly string[]): Promise<number[]> {
	return keys.map(Number)
}

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())

describe("create", () => {
	bench("createDataLoader", () => createDataLoader({ loader: fn }))
})

describe("load 1,000 different keys", () => {
	bench("createDataLoader.load", async () => {
		const loader = createDataLoader({ loader: fn })
		return Promise.all(keys.map((key) => loader.load(key)))
	})
})

const cachedLoader = createDataLoader({ loader: fn })
await Promise.all(keys.map((key) => cachedLoader.load(key)))

describe("load 1,000 cached keys", () => {
	bench("createDataLoader.load cached", () => {
		return Promise.all(keys.map((key) => cachedLoader.load(key)))
	})
})

describe("loadMany 1,000 keys", () => {
	bench("createDataLoader.loadMany", () => {
		return createDataLoader({ loader: fn }).loadMany(keys)
	})
})

/* oxlint-disable vitest/no-disabled-tests, vitest/valid-title -- comparison benchmarks do not run on CodSpeed */
const comparisonBench =
	process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null ? bench.skip : bench
/* oxlint-enable vitest/no-disabled-tests, vitest/valid-title */

describe("compare with dataloader and dldr", () => {
	comparisonBench("alleviate", () => {
		const loader = createDataLoader({ loader: fn })
		return Promise.all(keys.map((key) => loader.load(key)))
	})

	comparisonBench("dataloader", () => {
		const loader = new DataLoader(fn)
		return Promise.all(keys.map((key) => loader.load(key)))
	})

	comparisonBench("dldr", () => {
		const load = factory(fn)
		return Promise.all(keys.map((key) => load(key)))
	})
})
