import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createTTLMap } from "./ttl-map.ts"

describe("createTTLMap", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	describe(".has()", () => {
		it("should return false when key does not exist", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			expect(map.has("key")).toBe(false)
		})

		it("should return true when key exists and has not expired", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			expect(map.has("key")).toBe(true)
		})

		it("should return false when key has expired", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			vi.advanceTimersByTime(1001)
			expect(map.has("key")).toBe(false)
		})

		it("should return true when key is exactly at expiry boundary", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			vi.advanceTimersByTime(999)
			expect(map.has("key")).toBe(true)
		})
	})

	describe(".get()", () => {
		it("should return null when key does not exist", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			expect(map.get("key")).toBeNull()
		})

		it("should return value when key exists and has not expired", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			expect(map.get("key")).toBe("value")
		})

		it("should return null when key has expired", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			vi.advanceTimersByTime(1001)
			expect(map.get("key")).toBeNull()
		})
	})

	describe(".peek()", () => {
		it("should return null when key does not exist", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			expect(map.peek("key")).toBeNull()
		})

		it("should return value when key exists and has not expired", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			expect(map.peek("key")).toBe("value")
		})

		it("should not return value even when key has expired (no expiry check)", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			vi.advanceTimersByTime(1001)
			expect(map.peek("key")).toBeNull()
		})
	})

	describe(".set()", () => {
		it("should store a value with the default ttl", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			expect(map.get("key")).toBe("value")
		})

		it("should allow overriding ttl per entry", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("short", "value", 500)
			map.set("long", "value", 2000)

			vi.advanceTimersByTime(600)
			expect(map.has("short")).toBe(false)
			expect(map.has("long")).toBe(true)
		})

		it("should overwrite an existing key and reset its ttl", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "first")
			vi.advanceTimersByTime(800)
			map.set("key", "second")
			vi.advanceTimersByTime(400)
			expect(map.get("key")).toBe("second")
		})
	})

	describe(".delete()", () => {
		it("should remove an existing key", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			map.delete("key")
			expect(map.has("key")).toBe(false)
			expect(map.get("key")).toBeNull()
		})

		it("should not throw when deleting a non-existent key", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			expect(() => map.delete("missing")).not.toThrow()
		})
	})

	describe(".clear()", () => {
		it("should remove all entries", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("a", "1")
			map.set("b", "2")
			map.set("c", "3")

			map.clear()

			expect(map.has("a")).toBe(false)
			expect(map.has("b")).toBe(false)
			expect(map.has("c")).toBe(false)
		})

		it("should allow setting new values after clear", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "old")
			map.clear()
			map.set("key", "new")
			expect(map.get("key")).toBe("new")
		})
	})

	describe("options.getRefreshesTTL", () => {
		it("get refreshes ttl by default", () => {
			const map = createTTLMap<string, string>({ ttl: 1000 })
			map.set("key", "value")
			vi.advanceTimersByTime(800)
			map.get("key")
			vi.advanceTimersByTime(300)
			expect(map.has("key")).toBe(true)
		})

		it("get does not refreshes ttl when getRefreshesTTL is false", () => {
			const map = createTTLMap<string, string>({ ttl: 1000, getRefreshesTTL: false })
			map.set("key", "value")
			vi.advanceTimersByTime(800)
			map.get("key") // should reset the TTL
			vi.advanceTimersByTime(800)
			expect(map.has("key")).toBe(false)
		})

		it("get with getRefreshesTTL eventually expires if not accessed", () => {
			const map = createTTLMap<string, string>({ ttl: 1000, getRefreshesTTL: true })
			map.set("key", "value")
			vi.advanceTimersByTime(1100)
			expect(map.has("key")).toBe(false)
		})
	})
})
