import { BatchError } from "../error.ts"
import { identify } from "object-identity"

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
	 * Defaults to `object-identity(data)`.
	 */
	cacheKeyFn?: (key: Key) => string
	/** Whether to cache errors *returned* from the loader (not the loader fn throwing). Defaults to `true` */
	cacheErrors?: boolean
	/** Max size of batch before splitting up calls to the loader. Defaults to infinite */
	maxBatchSize?: number
}

export function createDataLoader<Key, Value>(
	options: DataLoaderOptions<Key, Value>,
): DataLoader<Key, Value> {
	const cacheMap: Map<string, Value | PromiseLike<Value> | Error> | null =
		options.cache !== false ? ((options.cache !== true ? options.cache : null) ?? new Map()) : null
	const cacheKeyFn: (key: Key) => string = options.cacheKeyFn ?? ((key) => identify([key]))
	const { loader, cacheErrors = true, maxBatchSize } = options

	let queuedKeys: Key[] = []
	let queuedCacheKeys: string[] = []
	let queuedResolves: ((value: Value) => void)[] = []
	let queuedRejects: ((reason?: Error) => void)[] = []
	let microtaskWaiting = false

	const load: DataLoader<Key, Value>["load"] = (key) => {
		const cacheKey = cacheKeyFn(key)
		if (cacheMap?.has(cacheKey)) {
			const cached = cacheMap.get(cacheKey)!
			return cached instanceof Error ? Promise.reject(cached) : Promise.resolve(cached)
		}

		const { promise, resolve, reject } = Promise.withResolvers<Value>()

		queuedKeys.push(key)
		queuedCacheKeys.push(cacheKey)
		queuedResolves.push(resolve)
		queuedRejects.push(reject)
		cacheMap?.set(cacheKey, promise)

		if (!microtaskWaiting) {
			microtaskWaiting = true
			queueMicrotask(executeBatch)
		}

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

	function executeBatch() {
		const keys = queuedKeys
		const cacheKeys = queuedCacheKeys
		const resolves = queuedResolves
		const rejects = queuedRejects
		queuedKeys = []
		queuedCacheKeys = []
		queuedResolves = []
		queuedRejects = []

		const dispatch = (keys: Key[], cacheKeys: string[], resolves: ((value: Value) => void)[], rejects: ((reason?: Error) => void)[]) => {
			void loader(keys).then(
				(results) => {
					for (let i = 0; i < keys.length; i++) {
						const result = results[i]!
						if (result instanceof Error) {
							if (!cacheErrors) cacheMap?.delete(cacheKeys[i]!)
							rejects[i]!(result)
						} else {
							resolves[i]!(result)
						}
					}
					return null
				},
				(error: unknown) => {
					const batchError = new BatchError(error as Error)
					for (let i = 0; i < keys.length; i++) {
						cacheMap?.delete(cacheKeys[i]!)
						rejects[i]!(batchError)
					}
					return null
				},
			)
		}

		if (maxBatchSize == null) {
			dispatch(keys, cacheKeys, resolves, rejects)
		} else {
			for (let start = 0; start < keys.length; start += maxBatchSize) {
				dispatch(
					keys.slice(start, start + maxBatchSize),
					cacheKeys.slice(start, start + maxBatchSize),
					resolves.slice(start, start + maxBatchSize),
					rejects.slice(start, start + maxBatchSize),
				)
			}
		}

		microtaskWaiting = false
		if (queuedKeys.length !== 0) {
			queueMicrotask(executeBatch)
			microtaskWaiting = true
		}
	}

	return {
		load,
		loadMany,
		prime(key: Key, value: Value | PromiseLike<Value>) {
			cacheMap?.set(cacheKeyFn(key), value)
		},
		clear(key: Key) {
			cacheMap?.delete(cacheKeyFn(key))
		},
		clearAll() {
			cacheMap?.clear()
		},
	}
}
