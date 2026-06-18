import { TimeoutError } from "../error.ts"

import { type GenericFn, type QueueItem } from "./util.ts"

function timeoutPromise(ms: number): Promise<never> {
	return new Promise((_, reject) => reject(new TimeoutError(ms)))
}

type LimiterStatus = "idle" | "running" | "blocking"

export interface Limiter<Timeout = false> {
	readonly state: LimiterStatus
	readonly pool: number
	readonly queue: number

	/**
	 * Add a function to the queue to be executed as soon as possible.
	 *
	 * @param fn The function to run. An `AbortSignal` is be passed to the function if `timeout` is set.
	 *
	 * @example
	 * ```ts
	 * const result = await limiter.run(() => fetch("https://example.com"))
	 * ```
	 *
	 * @example
	 * With timeout and `AbortSignal`
	 * ```ts
	 * const limiter = createLimiter({ timeout: 1000 })
	 * const result = await limiter.run((signal) => fetch("https://example.com", { signal }))
	 * ```
	 */
	readonly run: <Return>(
		fn: (...args: Timeout extends true ? [AbortSignal] : []) => Promise<Return>,
	) => Promise<Return>
	readonly wrap: <Fn extends GenericFn>(fn: Fn) => (...args: Parameters<Fn>) => ReturnType<Fn>
}

export interface LimiterOptions {
	/** How many functions can be running concurrently. Defaults to `4`. */
	concurrency?: number
	/** How large the concurrency pool can be. Defaults to `concurrency`. */
	pool?: number
	/** How big the initial concurrency pool is. Defaults to `pool`. */
	initial?: number
	/** How much is added to the concurrency pool every `refillInterval`. Defaults to `pool`. */
	refill?: number
	/** How often in ms `refill` is added to the concurrency pool. Defaults to `1000`. */
	refillInterval?: number
	/** Whether to refill the concurrency pool past `pool`. Defaults to `false`. */
	refillOverLimit?: boolean
	/** Whether to reject the promise after `timeout` ms. Defaults to `null`, i.e. no timeout. */
	timeout?: number
}

export function createLimiter<Options extends LimiterOptions>(
	opts: Options = {} as never,
): Limiter<Options["timeout"] extends number ? true : false> {
	let concurrency = opts.concurrency ?? Math.round(navigator.hardwareConcurrency / 1.5)
	let limit = opts.pool ?? concurrency
	let pool = opts.initial ?? limit
	let active = 0
	let refill = opts.refill ?? limit
	let refillInterval = opts.refillInterval ?? 1000
	let interval: number | null = null

	let state: LimiterStatus = "idle"
	const queue: QueueItem[] = []

	function updateState() {
		if (active === 0) {
			state = "idle"
		} else if (active < pool) {
			state = "running"
		} else if (active >= pool) {
			state = "blocking"
		}
	}

	function initRefillInterval() {
		interval = setInterval(() => {
			pool = !opts.refillOverLimit ? Math.min(pool + refill, limit) : pool + refill
			if (queue.length === 0) return
			advance()
		}, refillInterval) as unknown as number
	}

	function advance() {
		if (interval == null) {
			initRefillInterval()
		}

		while (queue.length !== 0 && pool > 0 && active < concurrency) {
			pool--
			active++
			void executeQueueFn()
		}

		updateState()
	}

	async function executeQueueFn() {
		const { fn, resolve, reject } = queue.shift()!
		const controller = opts.timeout != null ? new AbortController() : undefined

		try {
			const promise =
				opts.timeout != null
					? Promise.race([fn(controller!.signal), timeoutPromise(opts.timeout)])
					: fn()
			resolve(await promise)
		} catch (error) {
			if (controller != null) controller.abort()
			reject(error)
		}

		active--
		advance()
	}

	const run: Limiter["run"] = (fn) => {
		const { promise, resolve, reject } = Promise.withResolvers<ReturnType<typeof fn>>()

		queue.push({ fn, resolve, reject })

		advance()

		return promise as ReturnType<typeof fn>
	}

	const wrap: Limiter["wrap"] =
		(fn) =>
		// @ts-expect-error: types aren't good enough to handle it
		async (...args: any[]) =>
			run(() => fn(...args))

	return {
		get state() {
			return state
		},
		get pool() {
			return pool
		},
		get queue() {
			return queue.length
		},
		run,
		wrap,
	}
}
