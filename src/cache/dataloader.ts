import { BatchError } from "../error.ts"
import { serializeUnknown } from "../util.ts"

export interface DataLoader<Key, Value> {
	load(key: Key): Promise<Value>
	loadMany(keys: ArrayLike<Key>): Promise<Array<Value | Error>>
	prime(key: Key, value: Value | PromiseLike<Value>): void
	clear(key: Key): void
	clearAll(): void
}

export interface DataLoaderOptions<Key, Value> {
	/**
	 * The function that receives a batch of keys, and returns an array of the results.
	 * The returned array *must* match the order of the keys.
	 */
	loader: (key: Key[]) => Promise<Array<Value | Error>>
	/**
	 * Pass a custom `Map` or set to `false` to disable automatic caching. Defaults to `true`
	 */
	cache?: boolean | Map<string, Value | PromiseLike<Value>>
	/**
	 * Customize cache key serialization.
	 * Defaults to `fnv1a-64(object-identity(data))`
	 */
	cacheKeyFn?: (key: Key) => string
	/** Whether to cache errors *returned* from the loader (not the loader fn throwing). Defaults to `true` */
	cacheErrors?: boolean
	/** Max size of batch before splitting up calls to the loader. Defaults to infinite */
	maxBatchSize?: number
}

type QueueItem<Key, Value> = {
	key: Key
	cacheKey: string
	resolve: (value: Value) => void
	reject: (reason?: Error) => void
}

export function createDataLoader<Key, Value>(
	options: DataLoaderOptions<Key, Value>,
): DataLoader<Key, Value> {
	const cacheMap: Map<string, Promise<Value> | Error> | null =
		options.cache !== false ? ((options.cache !== true ? options.cache : null) ?? new Map()) : null
	const cacheKeyFn: (key: Key) => string = options.cacheKeyFn ?? serializeUnknown

	let queue: QueueItem<Key, Value>[] = []
	let microtaskWaiting = false

	const load: DataLoader<Key, Value>["load"] = (key): Promise<Value> => {
		const cacheKey = cacheKeyFn(key)
		if (cacheMap?.has(cacheKey)) {
			const value = cacheMap.get(cacheKey)!

			return value instanceof Error ? Promise.reject(value) : value
		}

		const { promise, resolve, reject } = Promise.withResolvers<Value>()

		if (!microtaskWaiting) {
			microtaskWaiting = true
			queueMicrotask(dispatch)
		}
		queue.push({ key, cacheKey, resolve, reject })
		cacheMap?.set(cacheKey, promise)

		return promise
	}

	const loadMany: DataLoader<Key, Value>["loadMany"] = async (keys) =>
		Promise.all(
			Array.from(keys, (key) =>
				load(key).catch((error: unknown) =>
					error instanceof Error ? error : new Error(String(error)),
				),
			),
		)

	function dispatch(): void {
		microtaskWaiting = false

		// Swap arrays instead of repeatedly shifting/splicing the shared queue.
		const items = queue
		queue = []

		if (items.length === 0) return

		if (options.maxBatchSize == null) {
			void executeBatch(items, 0, items.length)
			return
		}

		// Start every chunk without awaiting the preceding chunk.
		for (let start = 0; start < items.length; start += options.maxBatchSize) {
			const end = Math.min(start + options.maxBatchSize, items.length)
			void executeBatch(items, start, end)
		}
	}

	async function executeBatch(items: QueueItem<Key, Value>[], start: number, end: number) {
		microtaskWaiting = false

		const length = end - start
		// oxlint-disable-next-line unicorn/no-new-array
		const keys = new Array<Key>(length)
		for (let i = 0; i < length; i++) {
			keys[i] = items[start + i]!.key
		}

		try {
			const results = await options.loader(keys)

			for (let i = 0; i < length; i++) {
				const result = results[i]!
				const queueItem = items[i + start]!

				if (result instanceof Error) {
					if (options.cacheErrors !== false) {
						cacheMap?.set(queueItem.cacheKey, result)
					} else {
						cacheMap?.delete(queueItem.cacheKey)
					}

					queueItem.reject(result)
				} else {
					cacheMap?.set(queueItem.cacheKey, Promise.resolve(result))
					queueItem.resolve(result)
				}
			}
		} catch (error) {
			const batchError = new BatchError(error as Error)
			for (let i = 0; i < items.length; i++) {
				items[i + start]!.reject(batchError)
			}
		}
	}

	return {
		load,
		loadMany,
		prime(key: Key, value: Value | PromiseLike<Value>) {
			cacheMap?.set(cacheKeyFn(key), Promise.resolve(value))
		},
		clear(key: Key) {
			cacheMap?.delete(cacheKeyFn(key))
		},
		clearAll() {
			cacheMap?.clear()
		},
	}
}
