import { type GenericFn, type QueueItem } from "./util.ts"

type QueueStatus = "idle" | "running" | "blocking"

export interface Queue {
	readonly state: QueueStatus
	readonly concurrency: number
	readonly queue: number

	/**
	 * Add a function to the queue to be executed as soon as possible.
	 *
	 * @param fn The function to run. An `AbortSignal` is be passed to the function if `timeout` is set.
	 *
	 * @example
	 * ```ts
	 * const result = await queue.run(() => fetch("https://example.com"))
	 * ```
	 *
	 * @example
	 * With timeout and `AbortSignal`
	 * ```ts
	 * const queue = createQueue({ timeout: 1000 })
	 * const result = await queue.run((signal) => fetch("https://example.com", { signal }))
	 * ```
	 */
	readonly run: <Return>(fn: () => Promise<Return>) => Promise<Return>
	readonly wrap: <Fn extends GenericFn>(fn: Fn) => (...args: Parameters<Fn>) => ReturnType<Fn>
}

export interface QueueOptions {
	/** How many functions can be running concurrently. Defaults to `4`. */
	concurrency?: number
}

export function createQueue(opts: QueueOptions = {}): Queue {
	let concurrency = opts.concurrency ?? Math.round(navigator.hardwareConcurrency / 1.5)
	let active = 0

	let state: QueueStatus = "idle"
	const queue: QueueItem[] = []

	function updateState() {
		if (active === 0) {
			state = "idle"
		} else if (active < concurrency) {
			state = "running"
		} else if (active >= concurrency) {
			state = "blocking"
		}
	}

	function advance() {
		while (queue.length !== 0 && active < concurrency) {
			active++
			void executeQueueFn()
		}

		updateState()
	}

	async function executeQueueFn() {
		const { fn, resolve, reject } = queue.shift()!

		try {
			resolve(await fn())
		} catch (error) {
			reject(error)
		}

		active--
		advance()
	}

	const run: Queue["run"] = (fn) => {
		const { promise, resolve, reject } = Promise.withResolvers<ReturnType<typeof fn>>()

		queue.push({ fn, resolve, reject })

		advance()

		return promise as ReturnType<typeof fn>
	}

	const wrap: Queue["wrap"] =
		(fn) =>
		// @ts-expect-error: types aren't good enough to handle it
		async (...args: any[]) =>
			run(() => fn(...args))

	return {
		get state() {
			return state
		},
		get concurrency() {
			return concurrency
		},
		get queue() {
			return queue.length
		},
		run,
		wrap,
	}
}
