import { createLRU } from "alleviate"
import flru from "flru"
import { bench, describe } from "vitest"

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())
const missingKeys = Array.from({ length: 1_000 }, (_, index) => `missing-${index}`)

function createPopulatedLRU() {
	const lru = createLRU<string, string>({ max: keys.length })
	for (const key of keys) lru.set(key, key)
	return lru
}

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

describe("create", () => {
	bench("createLRU", () => {
		result = createLRU({ max: 1_000 })
	})
})

describe("get 1,000 existing keys", () => {
	const lru = createPopulatedLRU()

	bench("createLRU.get hit", () => {
		for (const key of keys) result = lru.get(key)
	})
})

describe("get 1,000 missing keys", () => {
	const lru = createPopulatedLRU()

	bench("createLRU.get miss", () => {
		for (const key of missingKeys) result = lru.get(key)
	})
})

describe("has 1,000 existing keys", () => {
	const lru = createPopulatedLRU()

	bench("createLRU.has", () => {
		for (const key of keys) result = lru.has(key)
	})
})

describe("set 1,000 keys", () => {
	bench("createLRU.set", () => {
		const lru = createLRU<string, string>({ max: keys.length })
		for (const key of keys) lru.set(key, key)
		result = lru
	})
})

describe("set 1,000 keys with eviction", () => {
	bench("createLRU.set with eviction", () => {
		const lru = createLRU<string, string>({ max: 100 })
		for (const key of keys) lru.set(key, key)
		result = lru
	})
})

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with flru",
	() => {
		bench("alleviate", () => {
			const lru = createLRU<string, string>({ max: keys.length })
			for (const key of keys) lru.set(key, key)
			for (const key of keys) lru.get(key)
			result = lru
		})

		bench("flru", () => {
			const lru = flru(keys.length)
			for (const key of keys) lru.set(key, key)
			for (const key of keys) lru.get(key)
			result = lru
		})
	},
)
