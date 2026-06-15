import { TimeoutError } from "./error.ts"

function timeoutPromise(ms: number): Promise<never> {
	return new Promise((_, reject) => reject(new TimeoutError(ms)))
}

type GenericFn = (...args: any) => Promise<any>

type LimiterStatus = "idle" | "running" | "blocking"

type QueueItem = {
	fn: GenericFn
	resolve: (value: any) => void
	reject: (error: unknown) => void
}

type Limiter = {
	readonly state: LimiterStatus
	readonly pool: number
	readonly queue: number

	readonly run: <Fn extends GenericFn>(fn: Fn) => ReturnType<Fn>
	readonly wrap: <Fn extends GenericFn>(fn: Fn) => (...args: Parameters<Fn>) => ReturnType<Fn>
}

type LimiterOptions = {
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

// TODO: default concurrency
export function createLimiter(opts: LimiterOptions = {}): Limiter {
	let concurrency = opts.concurrency ?? 4
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

	let isQueued = false
	function advance() {
		if (isQueued) return

		queueMicrotask(() => {
			if (interval == null) {
				initRefillInterval()
			}

			while (queue.length !== 0 && pool > 0 && active < concurrency) {
				pool--
				active++
				void executeQueueFn()
			}

			updateState()
			isQueued = false
		})
		isQueued = true
	}

	async function executeQueueFn() {
		const { fn, resolve, reject } = queue.shift()!

		try {
			const promise =
				opts.timeout != null ? Promise.race([fn(), timeoutPromise(opts.timeout)]) : fn()
			resolve(await promise)
		} catch (error) {
			reject(error)
		}

		active--
		advance()
	}

	const run: Limiter["run"] = async (fn) => {
		const { promise, resolve, reject } = Promise.withResolvers<ReturnType<typeof fn>>()

		queue.push({ fn, resolve, reject })

		advance()

		return promise
	}

	const wrap: Limiter["wrap"] =
		async (fn) =>
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
