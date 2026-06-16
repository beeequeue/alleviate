import { describe, expect, it } from "vitest"

import { createLRU } from "./lru.ts"

describe("createMapLru", () => {
	describe(".get()", () => {
		it("should return null when key is not found", () => {
			const lru = createLRU<string, string>()
			expect(lru.get("1")).toBeNull()
		})

		it("should return value when it exists", () => {
			const lru = createLRU<string, string>()
			lru.set("1", "value")
			expect(lru.get("1")).toBe("value")
		})
	})

	describe(".set()", () => {
		it("should evict values after `max` * 2", () => {
			const lru = createLRU({ max: 3 })
			for (let i = 0; i < 6; i++) {
				lru.set(i.toString(), i.toString())
			}

			// 3 fresh, 3 stale
			for (let i = 0; i < 6; i++) {
				expect(lru.has(i.toString())).toBe(true)
			}

			lru.set("7", "7")
			expect(lru.has("7")).toBe(true)
			// 3 stale entries have been evicted
			expect(lru.has("0")).toBe(false)
			expect(lru.has("1")).toBe(false)
			expect(lru.has("2")).toBe(false)
			// 3 new stale entries
			expect(lru.has("3")).toBe(true)
			expect(lru.has("4")).toBe(true)
			expect(lru.has("5")).toBe(true)
		})
	})

	it(".clear()", () => {
		const lru = createLRU<string, number>({ max: 3 })
		const keys = ["a", "b", "c"]
		keys.forEach((key, i) => lru.set(key, i))

		for (const key of keys) {
			expect(lru.has(key)).toBe(true)
		}

		lru.clear()
		for (const key of keys) {
			expect(lru.has(key)).toBe(false)
		}
	})
})
