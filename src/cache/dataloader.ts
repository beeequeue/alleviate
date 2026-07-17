import { identify } from "object-identity"

export interface DataLoader<Key, Value> {
	load(key: Key): Promise<Value>
	loadMany(keys: ArrayLike<Key>): Promise<Array<Value | Error>>
	prime(key: Key, value: Value | PromiseLike<Value>): void
	clear(key: Key): void
	clearAll(): void
}

export interface DataLoaderOptions<Key, Value> {
	loader: (key: Key[]) => Promise<Array<Value | Error>>
	/**
	 * Pass a custom `Map` or set to `false` to disable automatic caching
	 * @default true
	 */
	cache?: boolean | Map<string, Value | PromiseLike<Value>>
	/** Customize cache key serialization. */
	cacheKeyFn?: (key: Key) => string
	batch?: boolean // why would this be an option??
	maxBatchSize?: number
}

type QueueItem<Key, Value> = {
	key: Key
	resolve: (value: Value) => void
	reject: (reason?: Error) => void
}

export function createDataloader<Key, Value>(
	options: DataLoaderOptions<Key, Value>,
): DataLoader<Key, Value> {
	const cacheMap: Map<string, Value | PromiseLike<Value>> | null =
		options.cache !== false ? ((options.cache !== true ? options.cache : null) ?? new Map()) : null
	const cacheKeyFn: (key: Key) => string = options.cacheKeyFn ?? identify

	const queue: QueueItem<Key, Value>[] = []
	let microtaskWaiting = false

	const load: DataLoader<Key, Value>["load"] = async (key) => {
		const cacheKey = cacheKeyFn(key)
		if (cacheMap?.has(cacheKey)) {
			return cacheMap.get(cacheKey)!
		}

		const { promise, resolve, reject } = Promise.withResolvers<Value>()

		if (!microtaskWaiting) {
			queueMicrotask(executeBatch)
			microtaskWaiting = true
		}
		queue.push({ key, resolve, reject })
		cacheMap?.set(cacheKey, promise)

		return promise
	}

	const loadMany: DataLoader<Key, Value>["loadMany"] = (keys) =>
		Promise.all(
			Array.from(keys, (key) =>
				load(key).catch((error: unknown) =>
					error instanceof Error ? error : new Error(error?.toString()),
				),
			),
		)

	async function executeBatch() {
		microtaskWaiting = false
		const batch = queue.splice(0, options.maxBatchSize ?? queue.length)

		const results = await options.loader(batch.map(({ key }) => key))

		for (let i = 0; i < batch.length; i++) {
			const result = results[i]!
			if (result instanceof Error) {
				batch[i]!.reject(result)
			} else {
				cacheMap?.set(cacheKeyFn(batch[i]!.key), result)
				batch[i]!.resolve(result)
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
