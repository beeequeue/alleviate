// oxlint-disable vitest/require-mock-type-parameters

import { identify } from "object-identity"
import { describe, expect, expectTypeOf, it, vi } from "vitest"

import { BatchError } from "../error.ts"

import { createDataloader } from "./dataloader.ts"

describe("DataLoader", () => {
	describe(".load()", () => {
		it("returns a single value from the batch loader", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			const result = await dataloader.load(5)
			expectTypeOf(result).toBeNumber()
			expect(result).toBe(10)
			expect(loader).toHaveBeenCalledOnce()
			expect(loader).toHaveBeenCalledWith([5])
		})

		it("batches multiple loads in the same microtask", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			const promises = [1, 2, 3].map((k) => dataloader.load(k))
			const results = await Promise.all(promises)

			expect(results).toEqual([2, 4, 6])
			expect(loader).toHaveBeenCalledOnce()
			expect(loader).toHaveBeenCalledWith([1, 2, 3])
		})

		it("caches results and does not call loader twice for the same key", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			await dataloader.load(1)
			await dataloader.load(1)

			expect(loader).toHaveBeenCalledOnce()
			expect(loader).toHaveBeenCalledWith([1])
		})

		it("returns cached value synchronously on second call", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			const first = await dataloader.load(7)
			expect(first).toBe(14)

			const second = await dataloader.load(7)
			expect(second).toBe(14)
			expect(loader).toHaveBeenCalledOnce()
		})

		it("rejects when the loader returns an Error for a key", async () => {
			const loader = vi.fn(async (_keys: number[]) => [new Error("not found")])
			const dataloader = createDataloader<number, number>({ loader })

			await expect(dataloader.load(1)).rejects.toThrow("not found")
		})

		it("preserves order of results even with mixed errors and values", async () => {
			const loader = vi.fn(async (keys: number[]) =>
				keys.map((k) => (k === 2 ? new Error("bad key") : k * 10)),
			)
			const dataloader = createDataloader<number, number>({ loader })

			const promises = [1, 2, 3].map((k) => dataloader.load(k).catch((e) => e))
			const results = await Promise.all(promises)

			expect(results[0]).toBe(10)
			expect(results[1]).toBeInstanceOf(Error)
			expect((results[1] as Error).message).toBe("bad key")
			expect(results[2]).toBe(30)
		})

		it("rejects when the loader throws", async () => {
			const loader = vi.fn(async (_keys: number[]): Promise<number[]> => {
				throw new Error("testing loader throwing")
			})
			const dataloader = createDataloader<number, number>({ loader })

			await expect(dataloader.load(1)).rejects.toThrow(BatchError)
			expect(loader).toHaveBeenCalledOnce()
			expect(loader).toHaveBeenCalledWith([1])
		})
	})

	describe(".loadMany()", () => {
		it("returns an array of values for multiple keys", async () => {
			const loader = vi.fn(async (keys: string[]) => keys.map((k) => k.toUpperCase()))
			const dataloader = createDataloader<string, string>({ loader })

			const results = await dataloader.loadMany(["a", "b", "c"])
			expectTypeOf(results).toBeArray()
			expect(results).toEqual(["A", "B", "C"])
		})

		it("returns Error objects in the array for failed keys", async () => {
			const loader = vi.fn(async (keys: string[]) =>
				keys.map((k) => (k === "bad" ? new Error("nope") : k.toUpperCase())),
			)
			const dataloader = createDataloader<string, string>({ loader })

			const results = await dataloader.loadMany(["good", "bad", "ok"])
			expect(results).toHaveLength(3)
			expect(results[0]).toBe("GOOD")
			expect(results[1]).toBeInstanceOf(Error)
			expect(results[2]).toBe("OK")
		})

		it("rejects when the loader throws", async () => {
			const loader = vi.fn(async (_keys: number[]): Promise<number[]> => {
				throw new Error("testing loader throwing")
			})
			const dataloader = createDataloader<number, number>({ loader })

			const results = await dataloader.loadMany([1, 2])

			expect(results).toHaveLength(2)
			expect(results[0]).toBeInstanceOf(BatchError)
			expect(results[1]).toBeInstanceOf(BatchError)
			expect(loader).toHaveBeenCalledOnce()
			expect(loader).toHaveBeenCalledWith([1, 2])
		})
	})

	describe("batching", () => {
		it("respects maxBatchSize and processes remaining queue in a second batch", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({
				loader,
				maxBatchSize: 3,
			})

			const promises = [1, 2, 3, 4, 5].map((k) => dataloader.load(k))
			const results = await Promise.all(promises)

			expect(results).toEqual([2, 4, 6, 8, 10])
			expect(loader).toHaveBeenCalledTimes(2)
			expect(loader).toHaveBeenNthCalledWith(1, [1, 2, 3])
			expect(loader).toHaveBeenNthCalledWith(2, [4, 5])
		})

		it("processes items added mid-batch in a subsequent batch", async () => {
			let firstBatchKeys: number[] = []
			const loader = vi.fn(async (keys: number[]) => {
				if (firstBatchKeys.length === 0) {
					firstBatchKeys = [...keys]
				}
				return keys.map((k) => k * 2)
			})
			const dataloader = createDataloader<number, number>({ loader })

			const p1 = dataloader.load(1)
			const p2 = dataloader.load(2)
			// After first batch starts, load more
			void p1.then((v) => dataloader.load(v + 100))

			expect(await p1).toBe(2)
			expect(await p2).toBe(4)
			// Wait for mid-batch load to resolve
			await vi.waitFor(async () => {
				expect(loader).toHaveBeenCalledTimes(2)
			})

			expect(firstBatchKeys).toEqual([1, 2])
		})

		it("creates a new microtask for items added mid-batch", async () => {
			const batchCalls: number[][] = []
			const ref = {} as {
				dataloader: ReturnType<typeof createDataloader<number, number>>
			}
			let midBatchPromise: Promise<number> | undefined
			const loader = vi.fn(async (keys: number[]) => {
				batchCalls.push([...keys])
				// Simulate a load triggered mid-batch during loader execution
				if (batchCalls.length === 1) {
					midBatchPromise = ref.dataloader.load(100)
				}
				return keys.map((k) => k * 2)
			})
			ref.dataloader = createDataloader<number, number>({ loader })

			const results = await Promise.all([ref.dataloader.load(1), ref.dataloader.load(2)])
			expect(results).toEqual([2, 4])

			// The mid-batch load(100) triggers a second batch via a new microtask
			await vi.waitFor(() => {
				expect(loader).toHaveBeenCalledTimes(2)
			})
			expect(batchCalls[0]).toEqual([1, 2])
			expect(batchCalls[1]).toEqual([100])
			expect(await midBatchPromise).toBe(200)
		})
	})

	describe("caching", () => {
		it("disables caching when cache is false", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({
				loader,
				cache: false,
			})

			await dataloader.load(1)
			await dataloader.load(1)

			expect(loader).toHaveBeenCalledTimes(2)
		})

		it("uses a custom cache Map when provided", async () => {
			const customCache = new Map<string, number>()
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({
				loader,
				cache: customCache,
			})

			await dataloader.load(1)
			expect(customCache.size).toBe(1)
			expect(customCache.has(identify(1))).toBe(true)

			// Second load should use cache, not call loader again
			await dataloader.load(1)
			expect(loader).toHaveBeenCalledOnce()
		})

		it("uses a custom cacheKeyFn for cache keys", async () => {
			const cacheKeyFn = vi.fn((k: number) => `key:${k}`)
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({
				loader,
				cacheKeyFn,
			})

			await dataloader.load(42)
			expect(cacheKeyFn).toHaveBeenCalledWith(42)
			expect(cacheKeyFn).toHaveReturnedWith("key:42")
		})

		it("shares a single promise for concurrent loads of the same key", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			const [a, b] = await Promise.all([dataloader.load(1), dataloader.load(1)])

			expect(a).toBe(2)
			expect(b).toBe(2)
			expect(loader).toHaveBeenCalledOnce()
			expect(loader).toHaveBeenCalledWith([1])
		})
	})

	describe(".prime()", () => {
		it("stores a value in the cache without calling the loader", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			dataloader.prime(5, 99)
			const result = await dataloader.load(5)

			expect(result).toBe(99)
			expect(loader).not.toHaveBeenCalled()
		})

		it("does nothing when caching is disabled", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({
				loader,
				cache: false,
			})

			dataloader.prime(5, 99)
			const result = await dataloader.load(5)

			expect(result).toBe(10)
			expect(loader).toHaveBeenCalledOnce()
		})
	})

	describe(".clear()", () => {
		it("removes a single key from the cache", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			await dataloader.load(1)
			expect(loader).toHaveBeenCalledOnce()

			dataloader.clear(1)
			await dataloader.load(1)
			expect(loader).toHaveBeenCalledTimes(2)
		})

		it("does not remove other cached keys", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			await Promise.all([dataloader.load(1), dataloader.load(2)])
			dataloader.clear(1)

			await dataloader.load(2)
			expect(loader).toHaveBeenCalledOnce()
		})
	})

	describe(".clearAll()", () => {
		it("removes all keys from the cache", async () => {
			const loader = vi.fn(async (keys: number[]) => keys.map((k) => k * 2))
			const dataloader = createDataloader<number, number>({ loader })

			await Promise.all([dataloader.load(1), dataloader.load(2)])
			dataloader.clearAll()

			await Promise.all([dataloader.load(1), dataloader.load(2)])
			expect(loader).toHaveBeenCalledTimes(2)
		})
	})
})
