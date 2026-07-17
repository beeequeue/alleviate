// oxlint-disable vitest/require-mock-type-parameters
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, type Mock, vi } from "vitest"

import { createLimiter } from "./limiter.ts"

let spies: Mock[] = []

beforeEach(() => {
	vi.useFakeTimers()
	spies = []
})

afterEach(() => {
	vi.useRealTimers()
})

describe("Limiter", () => {
	it("runs a function immediately if queue is empty", async () => {
		const limiter = createLimiter()

		const value = Math.random()
		const result = await limiter.run(async () => value)
		expectTypeOf(result).toBeNumber()

		expect(result).toBe(value)
		expect(limiter.queue).toEqual(0)
	})

	it("runs functions in order", { timeout: 1500 }, async () => {
		const limiter = createLimiter({ concurrency: 1, refillInterval: 200 })

		for (let i = 0; i < 10; i++) {
			const spy = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 100)))
			spies.push(spy)
			void limiter.run(spy)
		}
		expect(limiter.queue).toEqual(9)

		// oxlint-disable no-await-in-loop
		for (let i = 0; i < 10; i++) {
			expect(limiter.queue, `queue ${i}`).toEqual(9 - i)
			expect(spies[i], `called ${i}`).toHaveBeenCalledOnce()

			for (let j = 9; j > i; j--) {
				expect(spies[j], `not called ${i} ${j}`).not.toHaveBeenCalledOnce()
			}

			await vi.advanceTimersByTimeAsync(200)
			await Promise.resolve()
		}
		// oxlint-enable no-await-in-loop
	})

	it("runs functions in parallel up to concurrency limit", async () => {
		const limiter = createLimiter({ concurrency: 8 })

		for (let i = 0; i < 10; i++) {
			const spy = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)))
			spies.push(spy)
			void limiter.run(spy)
		}
		expect(limiter.queue).toEqual(2)
		expect(limiter.pool).toEqual(0)
		expect(limiter.state).toEqual("blocking")

		for (let i = 0; i < 8; i++) {
			expect(spies[i]).toHaveBeenCalledOnce()
		}

		await vi.advanceTimersToNextTimerAsync()
		expect(limiter.state).toEqual("running")

		for (let i = 8; i < 10; i++) {
			expect(spies[i]).toHaveBeenCalledOnce()
		}

		await vi.advanceTimersToNextTimerAsync()

		expect(limiter.queue).toEqual(0)
		expect(limiter.state).toEqual("idle")
	})

	it("continues with the next queued function after a rejection", async () => {
		const limiter = createLimiter({
			concurrency: 1,
			pool: 2,
		})

		const error = new Error("failed")
		const first = limiter.run(async () => {
			throw error
		})

		const secondSpy = vi.fn(async () => "next")
		const second = limiter.run(secondSpy)

		await expect(first).rejects.toBe(error)
		await expect(second).resolves.toBe("next")

		expect(secondSpy).toHaveBeenCalledOnce()
		expect(limiter.queue).toBe(0)
		expect(limiter.state).toBe("idle")
	})

	it("releases concurrency after a synchronous throw", async () => {
		const limiter = createLimiter({
			concurrency: 1,
			pool: 2,
		})

		const error = new Error("synchronous failure")
		const first = limiter.run(() => {
			throw error
		})

		const secondSpy = vi.fn(async () => "next")
		const second = limiter.run(secondSpy)

		await expect(first).rejects.toBe(error)
		await expect(second).resolves.toBe("next")

		expect(secondSpy).toHaveBeenCalledOnce()
		expect(limiter.queue).toBe(0)
		expect(limiter.state).toBe("idle")
	})

	it("waits for the first refill when the initial pool is empty", async () => {
		const limiter = createLimiter({
			concurrency: 1,
			pool: 1,
			initial: 0,
			refill: 1,
			refillInterval: 100,
		})

		const spy = vi.fn(async () => "done")
		const promise = limiter.run(spy)

		expect(spy).not.toHaveBeenCalled()
		expect(limiter.queue).toBe(1)
		expect(limiter.state).toBe("blocking")

		await vi.advanceTimersByTimeAsync(99)
		expect(spy).not.toHaveBeenCalled()

		await vi.advanceTimersByTimeAsync(1)

		expect(spy).toHaveBeenCalledOnce()
		await expect(promise).resolves.toBe("done")
		expect(limiter.queue).toBe(0)
		expect(limiter.state).toBe("idle")
	})

	describe("refill", () => {
		it("refills based on time since the latest execution", async () => {
			const limiter = createLimiter({
				concurrency: 1,
				pool: 1,
				refill: 1,
				refillInterval: 1000,
			})

			await limiter.run(async () => null) // Executes at 0ms.

			// Refill the consumed token.
			await vi.advanceTimersByTimeAsync(1000)
			expect(limiter.pool).toBe(1)

			// Execute halfway between the old interval boundaries.
			await vi.advanceTimersByTimeAsync(500)
			await limiter.run(async () => null) // Executes at 1500ms.

			const spy = vi.fn(async () => null)
			const promise = limiter.run(spy)

			expect(spy).not.toHaveBeenCalled()

			// The old setInterval implementation would refill at 2000ms.
			await vi.advanceTimersByTimeAsync(500)
			expect(spy).not.toHaveBeenCalled()

			// The new implementation should refill at 2500ms:
			// 1000ms after the latest execution.
			await vi.advanceTimersByTimeAsync(499)
			expect(spy).not.toHaveBeenCalled()

			await vi.advanceTimersByTimeAsync(1)
			expect(spy).toHaveBeenCalledOnce()

			await promise
		})

		it("applies all refill periods that have elapsed", async () => {
			const limiter = createLimiter({
				concurrency: 1,
				pool: 10,
				initial: 1,
				refill: 2,
				refillInterval: 100,
			})

			await limiter.run(async () => null)
			expect(limiter.pool).toBe(0)

			await vi.advanceTimersByTimeAsync(350)

			// Three complete periods: 3 × 2.
			expect(limiter.pool).toBe(6)

			// The remaining 50ms should be preserved.
			await vi.advanceTimersByTimeAsync(49)
			expect(limiter.pool).toBe(6)

			await vi.advanceTimersByTimeAsync(1)
			expect(limiter.pool).toBe(8)
		})

		it("caps elapsed refills at the configured pool limit", async () => {
			const limiter = createLimiter({
				concurrency: 1,
				pool: 3,
				initial: 0,
				refill: 2,
				refillInterval: 100,
			})

			await vi.advanceTimersByTimeAsync(500)

			expect(limiter.pool).toBe(3)
		})

		it("allows elapsed refills past the pool limit when configured", async () => {
			const limiter = createLimiter({
				concurrency: 1,
				pool: 3,
				initial: 0,
				refill: 2,
				refillInterval: 100,
				refillOverLimit: true,
			})

			await vi.advanceTimersByTimeAsync(500)

			expect(limiter.pool).toBe(10)
		})
	})

	describe("timeout", () => {
		it("rejects promise if timeout is reached", async () => {
			const limiter = createLimiter({ timeout: 100 })

			const spy = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)))
			const promise = limiter.run(spy)

			// oxlint-disable-next-line vitest/valid-expect
			const settled = expect(promise).rejects.toThrow("Promise timed out")

			await vi.advanceTimersByTimeAsync(100)

			await settled
			expect(spy).toHaveBeenCalledOnce()
			expect(limiter.queue).toEqual(0)
		})

		it("does not reject if timeout is not reached", async () => {
			const limiter = createLimiter({ timeout: 500 })

			let signal: AbortSignal
			const spy = vi.fn((sig) => {
				signal = sig
				return new Promise<void>((resolve) => setTimeout(resolve, 250))
			})

			const promise = limiter.run(spy)
			await vi.advanceTimersByTimeAsync(1000)
			await expect(promise).resolves.toBeUndefined()

			expect(signal!.aborted).toBe(false)
		})

		it("rejects and triggers AbortController if timeout is reached", async () => {
			const limiter = createLimiter({ timeout: 500 })

			let signal: AbortSignal
			const spy = vi.fn((sig) => {
				signal = sig
				return new Promise<void>((resolve) => setTimeout(resolve, 1000))
			})

			const promise = limiter.run(spy).catch(() => "rejected")
			await vi.advanceTimersByTimeAsync(1000)

			await expect(promise).resolves.toEqual("rejected")
			expect(signal!.aborted).toBe(true)
		})

		it("does nothing if timeout is null", async () => {
			const limiter = createLimiter()

			const value = Math.random()
			const spy = vi.fn(() => new Promise<number>((resolve) => setTimeout(resolve, 1000, value)))
			const promise = limiter.run(spy)

			// Run long past any plausible default timeout; it must still resolve.
			await vi.advanceTimersByTimeAsync(1000)

			await expect(promise).resolves.toBe(value)
			expect(spy).toHaveBeenCalledOnce()
			expect(limiter.queue).toEqual(0)
		})

		it("cleans up the timeout timer when the function settles first", async () => {
			const limiter = createLimiter({
				concurrency: 1,
				timeout: 1000,
			})

			const promise = limiter.run(async () => "done")

			await expect(promise).resolves.toBe("done")

			expect(limiter.state).toBe("idle")
			expect(vi.getTimerCount()).toBe(0)
		})
	})

	it("does not keep a timer running while the limiter is idle", async () => {
		const limiter = createLimiter({
			concurrency: 1,
			pool: 1,
			refillInterval: 1000,
		})

		await limiter.run(async () => null)

		expect(limiter.queue).toBe(0)
		expect(limiter.state).toBe("idle")
		expect(vi.getTimerCount()).toBe(0)
	})
})
