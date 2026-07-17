import { type GenericFn, type QueueItem, timeoutPromise } from "../util.ts"

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
	/** How large the pool can be. Defaults to `concurrency`. */
	pool?: number
	/** How big the initial pool is. Defaults to `pool`. */
	initial?: number
	/** How much is added to the pool every `refillInterval`. Defaults to `pool`. */
	refill?: number
	/** How often in ms `refill` is added to the pool. Defaults to `1000`. */
	refillInterval?: number
	/** Whether to refill the pool past `pool`. Defaults to `false`. */
	refillOverLimit?: boolean
	/** Whether to reject the promise after `timeout` ms. Defaults to `null`, i.e. no timeout. */
	timeout?: number
}

export function createLimiter<Options extends LimiterOptions>(
	opts: Options = {} as never,
): Limiter<Options["timeout"] extends number ? true : false> {
	const concurrency = opts.concurrency ?? Math.round(navigator.hardwareConcurrency / 1.5)
	const limit = opts.pool ?? concurrency
	const refill = opts.refill ?? limit
	const refillInterval = opts.refillInterval ?? 1000

	let pool = opts.initial ?? limit
	let active = 0
	let lastExecution = Date.now()
	let refillTimer: ReturnType<typeof setTimeout> | null = null

	let state: LimiterStatus = "idle"
	const queue: QueueItem[] = []

	function updateState() {
		if (queue.length > 0 && (pool === 0 || active >= concurrency)) {
			state = "blocking"
		} else if (active > 0) {
			state = "running"
		} else {
			state = "idle"
		}
	}

	function refillPool(now = Date.now()) {
		const elapsed = now - lastExecution
		const intervals = Math.floor(elapsed / refillInterval)

		if (intervals === 0) return

		const amount = intervals * refill

		pool = opts.refillOverLimit ? pool + amount : Math.min(pool + amount, limit)

		// Preserve any partial interval instead of resetting it.
		lastExecution += intervals * refillInterval
	}

	function scheduleRefill() {
		if (refillTimer != null || queue.length === 0 || pool > 0) {
			return
		}

		const elapsed = Date.now() - lastExecution
		const delay = Math.max(0, refillInterval - elapsed)

		refillTimer = setTimeout(() => {
			refillTimer = null
			advance()
		}, delay)
	}

	function advance() {
		refillPool()

		while (queue.length !== 0 && pool > 0 && active < concurrency) {
			pool--
			active++
			lastExecution = Date.now()

			void executeQueueFn()
		}

		scheduleRefill()
		updateState()
	}

	async function executeQueueFn() {
		const { fn, resolve, reject } = queue.shift()!

		// oxlint-disable-next-line no-undefined
		const controller = opts.timeout != null ? new AbortController() : undefined

		try {
			if (opts.timeout != null) {
				const timeout = timeoutPromise(opts.timeout)

				try {
					const result = await Promise.race([fn(controller!.signal), timeout.promise])

					resolve(result)
				} finally {
					timeout.cancel()
				}
			} else {
				resolve(await fn())
			}
		} catch (error) {
			controller?.abort()
			reject(error)
		} finally {
			active--
			advance()
		}
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
			refillPool()
			return pool
		},
		get queue() {
			return queue.length
		},
		run,
		wrap,
	}
}
