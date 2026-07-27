// oxlint-disable vitest/expect-expect

import { createLRU } from "alleviate"
import flru from "flru"
import { it } from "vitest"

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())
const missingKeys = Array.from({ length: 1_000 }, (_, index) => `missing-${index}`)

function createPopulatedLRU() {
	const lru = createLRU<string, string>({ max: keys.length })
	for (const key of keys) lru.set(key, key)
	return lru
}

it("create", async ({ bench }) => {
	await bench("createLRU", () => createLRU({ max: 1_000 })).run()
})

it("get 1,000 existing keys", async ({ bench }) => {
	const lru = createPopulatedLRU()

	await bench("createLRU.get hit", () => {
		let value: string | null = null
		for (const key of keys) value = lru.get(key)
		return value
	}).run()
})

it("get 1,000 missing keys", async ({ bench }) => {
	const lru = createPopulatedLRU()

	await bench("createLRU.get miss", () => {
		let value: string | null = null
		for (const key of missingKeys) value = lru.get(key)
		return value
	}).run()
})

it("has 1,000 existing keys", async ({ bench }) => {
	const lru = createPopulatedLRU()

	await bench("createLRU.has", () => {
		let exists = false
		for (const key of keys) exists = lru.has(key)
		return exists
	}).run()
})

it("set 1,000 keys", async ({ bench }) => {
	await bench("createLRU.set", () => {
		const lru = createLRU<string, string>({ max: keys.length })
		for (const key of keys) lru.set(key, key)
		return lru
	}).run()
})

it("set 1,000 keys with eviction", async ({ bench }) => {
	await bench("createLRU.set with eviction", () => {
		const lru = createLRU<string, string>({ max: 100 })
		for (const key of keys) lru.set(key, key)
		return lru
	}).run()
})

/* oxlint-disable vitest/no-disabled-tests, vitest/valid-title -- comparison benchmarks do not run on CodSpeed */
const comparison = it.skipIf(
	process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null,
)
/* oxlint-enable vitest/no-disabled-tests, vitest/valid-title */

comparison("compare with flru", async ({ bench }) => {
	const alleviate = () => {
		const lru = createLRU<string, string>({ max: keys.length })
		for (const key of keys) lru.set(key, key)
		for (const key of keys) lru.get(key)
		return lru
	}
	const upstream = () => {
		const lru = flru(keys.length)
		for (const key of keys) lru.set(key, key)
		for (const key of keys) lru.get(key)
		return lru
	}

	await bench.compare(bench("alleviate", alleviate), bench("flru", upstream))
})
