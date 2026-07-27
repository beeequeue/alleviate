import { BatchError } from "../error.ts"
import { serializeUnknown } from "../util.ts"

export interface DataLoader<Key, Value> {
	load(key: Key): Promise<Value>
	loadMany(keys: ArrayLike<Key>): Promise<Array<Value | Error>>
	prime(key: Key, value: Value | PromiseLike<Value>): void
	clear(key: Key): void
	clearAll(): void
}

export interface DataLoaderOptions<Key, Value, CacheKey = Key> {
	/**
	 * The function that receives a batch of keys, and returns an array of the results.
	 * The returned array *must* match the order of the keys.
	 */
	loader: (key: Key[]) => Promise<Array<Value | Error>>
	/**
	 * Pass a custom `Map` or set to `false` to disable automatic caching. Defaults to `true`
	 */
	cache?: boolean | Map<CacheKey, Value | PromiseLike<Value>>
	/**
	 * Customize cache key serialization.
	 * Defaults to structural identity for objects and direct identity for primitives.
	 */
	cacheKeyFn?: (key: Key) => CacheKey
	/** Whether to cache errors *returned* from the loader (not the loader fn throwing). Defaults to `true` */
	cacheErrors?: boolean
	/** Max size of batch before splitting up calls to the loader. Defaults to infinite */
	maxBatchSize?: number
}

type Callback<Value> = {
	resolve: (value: Value) => void
	reject: (reason?: Error) => void
}

export function createDataLoader<Key, Value, CacheKey = Key>(
	options: DataLoaderOptions<Key, Value, CacheKey>,
): DataLoader<Key, Value> {
	const cacheMap: Map<CacheKey, Value | PromiseLike<Value> | Error> | null =
		options.cache !== false ? ((options.cache !== true ? options.cache : null) ?? new Map()) : null
	const { cacheKeyFn } = options
	const { loader, cacheErrors = true, maxBatchSize } = options

	let queuedKeys: Key[] = []
	let queuedCallbacks: Callback<Value>[] = []
	let microtaskWaiting = false

	const getCacheKey = (key: Key): CacheKey =>
		cacheKeyFn == null ? (serializeUnknown(key) as CacheKey) : cacheKeyFn(key)

	const load: DataLoader<Key, Value>["load"] = (key) => {
		const cacheKey = getCacheKey(key)
		if (cacheMap?.has(cacheKey)) {
			const cached = cacheMap.get(cacheKey)!
			return cached instanceof Error ? Promise.reject(cached) : Promise.resolve(cached)
		}

		queuedKeys.push(key)
		const promise = new Promise<Value>((resolve, reject) => {
			queuedCallbacks.push({ resolve, reject })
		})
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

	const dispatch = (keys: Key[], callbacks: Callback<Value>[]) => {
		void loader(keys).then(
			(results) => {
				for (let i = 0; i < keys.length; i++) {
					const result = results[i]!
					if (result instanceof Error) {
						if (!cacheErrors) cacheMap?.delete(getCacheKey(keys[i]!))
						callbacks[i]!.reject(result)
					} else {
						callbacks[i]!.resolve(result)
					}
				}
				return null
			},
			(error: unknown) => {
				const batchError = new BatchError(error as Error)
				for (let i = 0; i < keys.length; i++) {
					cacheMap?.delete(getCacheKey(keys[i]!))
					callbacks[i]!.reject(batchError)
				}
				return null
			},
		)
	}

	function executeBatch() {
		const keys = queuedKeys
		const callbacks = queuedCallbacks
		queuedKeys = []
		queuedCallbacks = []

		if (maxBatchSize == null) {
			dispatch(keys, callbacks)
		} else {
			for (let start = 0; start < keys.length; start += maxBatchSize) {
				dispatch(
					keys.slice(start, start + maxBatchSize),
					callbacks.slice(start, start + maxBatchSize),
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
			cacheMap?.set(getCacheKey(key), value)
		},
		clear(key: Key) {
			cacheMap?.delete(getCacheKey(key))
		},
		clearAll() {
			cacheMap?.clear()
		},
	}
}
