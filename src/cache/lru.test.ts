// oxlint-disable vitest/expect-expect
import { describe, expect, it } from "vitest"

import { createLRU, type LRU } from "./lru.ts"

function keysExist(lru: LRU<string, unknown>, keys: string[], expected = true): void {
	for (const key of keys) {
		expect(lru.has(key), `${key} exists`).toBe(expected)
	}
}

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
			keysExist(lru, ["0", "1", "2", "3", "4", "5"])

			lru.set("7", "7")
			expect(lru.has("7")).toBe(true)
			// 3 stale entries have been evicted
			keysExist(lru, ["0", "1", "2"], false)
			// 3 new stale entries
			keysExist(lru, ["3", "4", "5"])
		})

		it("does not allow prototype pollution", () => {
			const lru = createLRU<string, unknown>({ max: 25 })

			// Attempt to pollute via the classic prototype-pollution keys.
			const dangerousKeys = ["__proto__", "constructor", "prototype"]

			for (const key of dangerousKeys) {
				lru.set(key, { polluted: true })
			}

			expect(({} as any).polluted).toBeUndefined()
			expect((Object.prototype as any).polluted).toBeUndefined()

			expect(lru.get("__proto__")).toEqual({ polluted: true })
			expect(lru.has("constructor")).toBe(true)
			expect(lru.peek("prototype")).toEqual({ polluted: true })

			const obj: Record<string, unknown> = {}
			expect(obj.polluted).toBeUndefined()
			expect(obj.constructor).toBe(Object)
		})
	})

	describe(".setMany()", () => {
		it("sets from tuples array", () => {
			const lru = createLRU({ max: 5 })
			lru.setMany([
				["0", "0"],
				["1", "1"],
				["2", "2"],
				["3", "3"],
				["4", "4"],
				["5", "5"],
			])

			// 3 fresh, 3 stale
			keysExist(lru, ["0", "1", "2", "3", "4", "5"])
		})

		it("sets from object array", () => {
			const lru = createLRU({ max: 5 })
			lru.setMany({
				0: "0",
				1: "1",
				2: "2",
				3: "3",
				4: "4",
				5: "5",
			})

			// 3 fresh, 3 stale
			keysExist(lru, ["0", "1", "2", "3", "4", "5"])
		})

		it("evicts old values", () => {
			const lru = createLRU({ max: 3 })
			lru.setMany([
				["0", "0"],
				["1", "1"],
				["2", "2"],
				["3", "3"],
				["4", "4"],
				["5", "5"],
			])

			keysExist(lru, ["0", "1", "2", "3", "4", "5"])

			lru.setMany([
				["6", "6"],
				["7", "7"],
				["8", "8"],
			])

			keysExist(lru, ["3", "4", "5", "6", "7", "8"])
			keysExist(lru, ["0", "1", "2"], false)
		})

		it("does not allow prototype pollution", () => {
			const lru = createLRU({ max: 25 })

			lru.setMany([
				["__proto__", { viaIterable: true }],
				["constructor", { viaIterable: true }],
			])
			expect(({} as any).viaIterable).toBeUndefined()

			lru.setMany(JSON.parse('{"__proto__": {"viaObject": true}}'))
			expect(({} as any).viaObject).toBeUndefined()
			expect((Object.prototype as any).viaObject).toBeUndefined()
		})
	})

	it(".clear()", () => {
		const lru = createLRU<string, number>({ max: 3 })
		const keys = ["a", "b", "c"]
		keys.forEach((key, i) => lru.set(key, i))

		keysExist(lru, keys)

		lru.clear()
		keysExist(lru, keys, false)
	})
})
