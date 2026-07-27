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

describe("create", () => {
	bench("createLRU", () => createLRU({ max: 1_000 }))
})

describe("get 1,000 existing keys", () => {
	const lru = createPopulatedLRU()

	bench("createLRU.get hit", () => {
		let value: string | null = null
		for (const key of keys) value = lru.get(key)
		return value
	})
})

describe("get 1,000 missing keys", () => {
	const lru = createPopulatedLRU()

	bench("createLRU.get miss", () => {
		let value: string | null = null
		for (const key of missingKeys) value = lru.get(key)
		return value
	})
})

describe("has 1,000 existing keys", () => {
	const lru = createPopulatedLRU()

	bench("createLRU.has", () => {
		let exists = false
		for (const key of keys) exists = lru.has(key)
		return exists
	})
})

describe("set 1,000 keys", () => {
	bench("createLRU.set", () => {
		const lru = createLRU<string, string>({ max: keys.length })
		for (const key of keys) lru.set(key, key)
		return lru
	})
})

describe("set 1,000 keys with eviction", () => {
	bench("createLRU.set with eviction", () => {
		const lru = createLRU<string, string>({ max: 100 })
		for (const key of keys) lru.set(key, key)
		return lru
	})
})

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with flru",
	() => {
		bench("alleviate", () => {
			const lru = createLRU<string, string>({ max: keys.length })
			for (const key of keys) lru.set(key, key)
			for (const key of keys) lru.get(key)
			return lru
		})

		bench("flru", () => {
			const lru = flru(keys.length)
			for (const key of keys) lru.set(key, key)
			for (const key of keys) lru.get(key)
			return lru
		})
	},
)
