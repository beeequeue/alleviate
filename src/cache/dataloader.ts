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
	const cacheMap: Map<string, PromiseLike<Value | Error>> | null =
		options.cache !== false ? ((options.cache !== true ? options.cache : null) ?? new Map()) : null
	const cacheKeyFn: (key: Key) => string = options.cacheKeyFn ?? serializeUnknown

	const queue: QueueItem<Key, Value>[] = []
	let microtaskWaiting = false

	const load: DataLoader<Key, Value>["load"] = (key): Promise<Value> => {
		const cacheKey = cacheKeyFn(key)
		if (cacheMap?.has(cacheKey)) {
			return cacheMap.get(cacheKey) as Promise<Value>
		}

		const { promise, resolve, reject } = Promise.withResolvers<Value>()

		if (!microtaskWaiting) {
			queueMicrotask(executeBatch)
			microtaskWaiting = true
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

	async function executeBatch() {
		microtaskWaiting = false
		const batch = queue.splice(0, options.maxBatchSize ?? queue.length)

		try {
			const results = await options.loader(batch.map(({ key }) => key))

			for (let i = 0; i < batch.length; i++) {
				const result = results[i]!

				if (result instanceof Error) {
					if (options.cacheErrors !== false) {
						cacheMap?.set(batch[i]!.cacheKey, Promise.reject(result))
					} else {
						cacheMap?.delete(batch[i]!.cacheKey)
					}

					batch[i]!.reject(result)
				} else {
					cacheMap?.set(batch[i]!.cacheKey, Promise.resolve(result))
					batch[i]!.resolve(result)
				}
			}
		} catch (error) {
			const batchError = new BatchError(error as Error)
			for (let i = 0; i < batch.length; i++) {
				batch[i]!.reject(batchError)
			}
		}

		// oxlint-disable-next-line typescript/no-unnecessary-condition
		if (!microtaskWaiting && queue.length !== 0) {
			queueMicrotask(executeBatch)
			microtaskWaiting = true
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
