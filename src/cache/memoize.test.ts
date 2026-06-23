// oxlint-disable vitest/require-mock-type-parameters
import { describe, expect, it, vi } from "vitest"

import { memoize } from "./memoize.ts"

describe("memoize", () => {
	describe("sync", () => {
		it("should return the result of the function", () => {
			const fn = memoize((a: number, b: number) => a + b)
			expect(fn(1, 2)).toBe(3)
		})

		it("should cache the result on subsequent calls", () => {
			const spy = vi.fn((a: number, b: number) => a + b)
			const fn = memoize(spy)
			fn(1, 2)
			fn(1, 2)
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should cache separately for different arguments", () => {
			const spy = vi.fn((a: number, b: number) => a + b)
			const fn = memoize(spy)
			expect(fn(1, 2)).toBe(3)
			expect(fn(2, 3)).toBe(5)
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should not cache null results by default", () => {
			const spy = vi.fn(() => null)
			const fn = memoize(spy)
			fn()
			fn()
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should not cache undefined results by default", () => {
			// oxlint-disable-next-line no-undefined
			const spy = vi.fn(() => undefined)
			const fn = memoize(spy)
			fn()
			fn()
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should cache null results when keepNullish is true", () => {
			const spy = vi.fn(() => null)
			const fn = memoize(spy, { keepNullish: true })
			fn()
			fn()
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should cache undefined results when keepNullish is true", () => {
			// oxlint-disable-next-line no-undefined
			const spy = vi.fn(() => undefined)
			const fn = memoize(spy, { keepNullish: true })
			fn()
			fn()
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should use custom serialize function for cache key", () => {
			const spy = vi.fn((obj: { id: number }) => obj.id)
			const fn = memoize(spy, { serialize: (obj) => String(obj.id) })
			fn({ id: 1 })
			fn({ id: 1 })
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should evict keys when cache size is reached", () => {
			const spy = vi.fn((obj: { id: number }) => obj.id)
			const fn = memoize(spy, { max: 2 })
			fn({ id: 1 })
			fn({ id: 2 })
			fn({ id: 3 })
			fn({ id: 1 })
			expect(spy).toHaveBeenCalledTimes(4)
		})
	})

	describe("async", () => {
		it("should return a promise with the result", async () => {
			const fn = memoize(async (a: number, b: number) => a + b)
			await expect(fn(1, 2)).resolves.toBe(3)
		})

		it("should cache the resolved value on subsequent calls", async () => {
			const spy = vi.fn(async (a: number, b: number) => a + b)
			const fn = memoize(spy)
			await fn(1, 2)
			await fn(1, 2)
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should cache separately for different arguments", async () => {
			const spy = vi.fn(async (a: number, b: number) => a + b)
			const fn = memoize(spy)
			await expect(fn(1, 2)).resolves.toBe(3)
			await expect(fn(2, 3)).resolves.toBe(5)
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should not cache null results by default", async () => {
			const spy = vi.fn(async () => null)
			const fn = memoize(spy)
			await fn()
			await fn()
			expect(spy).toHaveBeenCalledTimes(2)
		})

		it("should cache null results when keepNullish is true", async () => {
			const spy = vi.fn(async () => null)
			const fn = memoize(spy, { keepNullish: true })
			await fn()
			await fn()
			expect(spy).toHaveBeenCalledTimes(1)
		})

		it("should reject and not cache on error", async () => {
			const spy = vi.fn(async () => {
				throw new Error("fail")
			})
			const fn = memoize(spy)
			await expect(fn()).rejects.toThrow("fail")
			await expect(fn()).rejects.toThrow("fail")
			expect(spy).toHaveBeenCalledTimes(2)
		})
	})
})
