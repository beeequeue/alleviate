import { createDataLoader } from "alleviate"
import DataLoader from "dataloader"
import { factory } from "dldr/cache"
import { bench, describe } from "vitest"

async function fn(keys: readonly string[]): Promise<number[]> {
	return keys.map(Number)
}

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())
const objectKeys = keys.map((key) => ({ key }))

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

describe("create", () => {
	bench("createDataLoader", () => {
		result = createDataLoader({ loader: fn })
	})
})

describe("load 1,000 cache misses", () => {
	bench("createDataLoader.load", async () => {
		const loader = createDataLoader({ loader: fn })
		await Promise.all(keys.map((key) => loader.load(key)))
	})
})

const cachedLoader = createDataLoader({ loader: fn })
await Promise.all(keys.map((key) => cachedLoader.load(key)))

describe("load 1,000 cached keys", () => {
	bench("createDataLoader.load cached", async () => {
		await Promise.all(keys.map((key) => cachedLoader.load(key)))
	})
})

describe("load 1,000 keys without caching", () => {
	bench("createDataLoader.load cache: false", async () => {
		const loader = createDataLoader({ loader: fn, cache: false })
		await Promise.all(keys.map((key) => loader.load(key)))
	})
})

describe("loadMany 1,000 keys", () => {
	bench("createDataLoader.loadMany", async () => {
		await createDataLoader({ loader: fn }).loadMany(keys)
	})
})

describe("finite batches", () => {
	bench("createDataLoader.load maxBatchSize: 100", async () => {
		const loader = createDataLoader({ loader: fn, maxBatchSize: 100 })
		await Promise.all(keys.map((key) => loader.load(key)))
	})
})

describe("object identity", () => {
	bench("same object references", async () => {
		const loader = createDataLoader({ loader: async (batch) => batch })
		await Promise.all(objectKeys.map((key) => loader.load(key)))
	})

	bench("new objects with same shape", async () => {
		const loader = createDataLoader({ loader: async (batch) => batch })
		await Promise.all(keys.flatMap((key) => [loader.load({ key }), loader.load({ key })]))
	})
})

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with dataloader and dldr",
	() => {
		bench("alleviate", async () => {
			const loader = createDataLoader({ loader: fn })
			await Promise.all(keys.map((key) => loader.load(key)))
		})

		bench("dataloader", async () => {
			const loader = new DataLoader(fn)
			await Promise.all(keys.map((key) => loader.load(key)))
		})

		bench("dldr", async () => {
			const load = factory(fn)
			await Promise.all(keys.map((key) => load(key)))
		})
	},
)
