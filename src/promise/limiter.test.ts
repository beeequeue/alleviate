// oxlint-disable vitest/require-mock-type-parameters
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, type Mock, vi } from "vitest"

import { TimeoutError } from "../error.ts"

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
	describe(".run()", () => {
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
			// await Promise.resolve()

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
	})
})
