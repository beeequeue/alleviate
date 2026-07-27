// oxlint-disable vitest/expect-expect

import { createDataLoader } from "alleviate"
import DataLoader from "dataloader"
import { factory } from "dldr/cache"
import { it } from "vitest"

async function fn(keys: readonly string[]): Promise<number[]> {
	return keys.map(Number)
}

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())

it("create", async ({ bench }) => {
	await bench("createDataLoader", () => createDataLoader({ loader: fn })).run()
})

it("load 1,000 different keys", async ({ bench }) => {
	await bench("createDataLoader.load", async () => {
		const loader = createDataLoader({ loader: fn })
		return Promise.all(keys.map((key) => loader.load(key)))
	}).run()
})

it("load 1,000 cached keys", async ({ bench }) => {
	const loader = createDataLoader({ loader: fn })
	await Promise.all(keys.map((key) => loader.load(key)))

	await bench("createDataLoader.load cached", () => {
		return Promise.all(keys.map((key) => loader.load(key)))
	}).run()
})

it("loadMany 1,000 keys", async ({ bench }) => {
	await bench("createDataLoader.loadMany", () => {
		return createDataLoader({ loader: fn }).loadMany(keys)
	}).run()
})

/* oxlint-disable vitest/no-disabled-tests, vitest/valid-title -- comparison benchmarks do not run on CodSpeed */
const comparison = it.skipIf(
	process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null,
)
/* oxlint-enable vitest/no-disabled-tests, vitest/valid-title */

comparison("compare with dataloader and dldr", async ({ bench }) => {
	const alleviate = () => {
		const loader = createDataLoader({ loader: fn })
		return Promise.all(keys.map((key) => loader.load(key)))
	}
	const dataloader = () => {
		const loader = new DataLoader(fn)
		return Promise.all(keys.map((key) => loader.load(key)))
	}
	const dldr = () => {
		const load = factory(fn)
		return Promise.all(keys.map((key) => load(key)))
	}

	await bench.compare(
		bench("alleviate", alleviate),
		bench("dataloader", dataloader),
		bench("dldr", dldr),
	)
})
