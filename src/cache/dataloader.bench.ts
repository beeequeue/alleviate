// oxlint-disable vitest/expect-expect
import { createDataLoader } from "alleviate"
import DataLoader from "dataloader"
import { factory } from "dldr/cache"
import { test } from "vitest"

async function fn(keys: readonly string[]): Promise<number[]> {
	return keys.map(Number)
}

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())
const objectKeys = keys.map((key) => ({ key }))

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var loaderResult: any
// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

test("createDataLoader", async ({ bench }) => {
	await bench(
		"create",
		{
			beforeEach: () => {
				loaderResult = null
			},
		},
		() => {
			loaderResult = createDataLoader({ loader: fn })
		},
	).run()
})

test("load 1,000 cache misses", async ({ bench }) => {
	await bench("createDataLoader.load", async () => {
		const loader = createDataLoader({ loader: fn })
		result = await Promise.all(keys.map((key) => loader.load(key)))
	}).run()
})

const cachedLoader = createDataLoader({ loader: fn })
await Promise.all(keys.map((key) => cachedLoader.load(key)))

test("load 1,000 cached keys", async ({ bench }) => {
	await bench("createDataLoader.load cached", async () => {
		result = await Promise.all(keys.map((key) => cachedLoader.load(key)))
	}).run()
})

test("load 1,000 keys without caching", async ({ bench }) => {
	await bench("createDataLoader.load cache: false", async () => {
		const loader = createDataLoader({ loader: fn, cache: false })
		result = await Promise.all(keys.map((key) => loader.load(key)))
	}).run()
})

test("loadMany 1,000 keys", async ({ bench }) => {
	await bench("createDataLoader.loadMany", async () => {
		result = await createDataLoader({ loader: fn }).loadMany(keys)
	}).run()
})

test("finite batches", async ({ bench }) => {
	await bench("createDataLoader.load maxBatchSize: 100", async () => {
		const loader = createDataLoader({ loader: fn, maxBatchSize: 100 })
		result = await Promise.all(keys.map((key) => loader.load(key)))
	}).run()
})

test("object identity", async ({ bench }) => {
	await bench("same object references", async () => {
		const loader = createDataLoader({ loader: async (batch) => batch })
		result = await Promise.all(objectKeys.map((key) => loader.load(key)))
	}).run()

	await bench("new objects with same shape", async () => {
		const loader = createDataLoader({ loader: async (batch) => batch })
		result = await Promise.all(keys.flatMap((key) => [loader.load({ key }), loader.load({ key })]))
	}).run()
})

test.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with dataloader and dldr",
	async ({ bench }) => {
		await bench.compare(
			bench("alleviate", async () => {
				const loader = createDataLoader({ loader: fn })
				result = await Promise.all(keys.map((key) => loader.load(key)))
			}),
			bench("dataloader", async () => {
				const loader = new DataLoader(fn)
				result = await Promise.all(keys.map((key) => loader.load(key)))
			}),
			bench("dldr", async () => {
				const load = factory(fn)
				result = await Promise.all(keys.map((key) => load(key)))
			}),
		)
	},
)
