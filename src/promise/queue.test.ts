// oxlint-disable vitest/require-mock-type-parameters
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, type Mock, vi } from "vitest"

import { createQueue } from "./queue.ts"

let spies: Mock[] = []

beforeEach(() => {
	vi.useFakeTimers()
	spies = []
})

afterEach(() => {
	vi.useRealTimers()
})

describe("Queue", () => {
	describe(".run()", () => {
		it("runs a function immediately if queue is empty", async () => {
			const limiter = createQueue()

			const value = Math.random()
			const result = await limiter.run(async () => value)
			expectTypeOf(result).toBeNumber()

			expect(result).toBe(value)
			expect(limiter.queue).toEqual(0)
		})

		it("runs functions in order", async () => {
			const limiter = createQueue({ concurrency: 1 })

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

				await vi.advanceTimersByTimeAsync(100)
				await Promise.resolve()
			}
			// oxlint-enable no-await-in-loop
		})

		it("runs functions in parallel up to concurrency limit", async () => {
			const limiter = createQueue({ concurrency: 8 })

			for (let i = 0; i < 10; i++) {
				const spy = vi.fn(() => new Promise<void>((resolve) => setTimeout(resolve, 1000)))
				spies.push(spy)
				void limiter.run(spy)
			}
			expect(limiter.queue).toEqual(2)
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
})
