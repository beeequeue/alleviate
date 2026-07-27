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

type Resolver<Value> = {
	promise: Promise<Value>
	resolve: (value: Value) => void
	reject: (reason?: unknown) => void
}

export function createDataLoader<Key, Value>(
	options: DataLoaderOptions<Key, Value>,
): DataLoader<Key, Value> {
	const cacheMap: Map<string, Promise<Value> | Error> | null =
		options.cache !== false ? ((options.cache !== true ? options.cache : null) ?? new Map()) : null
	const cacheKeyFn: (key: Key) => string = options.cacheKeyFn ?? serializeUnknown

	const loader = options.loader
	const maxBatchSize = options.maxBatchSize ?? Infinity
	const cacheErrors = options.cacheErrors !== false
	const bounded = maxBatchSize !== Infinity

	let queueKeys: Key[] = []
	let queueCacheKeys: string[] = []
	let queueResolvers: Resolver<Value>[] = []
	let microtaskWaiting = false

	const load: DataLoader<Key, Value>["load"] = (key): Promise<Value> => {
		const cacheKey = cacheKeyFn(key)
		const cached = cacheMap?.get(cacheKey)
		if (cached !== undefined) {
			return cached instanceof Error ? Promise.reject(cached) : cached
		}

		const resolver = Promise.withResolvers<Value>() as Resolver<Value>

		if (!microtaskWaiting) {
			microtaskWaiting = true
			queueMicrotask(dispatch)
		}

		queueKeys.push(key)
		queueCacheKeys.push(cacheKey)
		queueResolvers.push(resolver)
		cacheMap?.set(cacheKey, resolver.promise)

		return resolver.promise
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

		// Swap so items enqueued during dispatch start a fresh batch.
		const keys = queueKeys
		const cacheKeys = queueCacheKeys
		const resolvers = queueResolvers
		queueKeys = []
		queueCacheKeys = []
		queueResolvers = []

		const length = resolvers.length
		if (length === 0) return

		if (!bounded) {
			executeBatch(keys, cacheKeys, resolvers, 0, length, true)
			return
		}

		for (let start = 0; start < length; start += maxBatchSize) {
			const end = Math.min(start + maxBatchSize, length)
			// Only the first chunk (start === 0) coincides with the head of `keys`,
			// so it could be passed zero-copy — but for bounded loads that single batch
			// almost never covers the whole queue, so just always slice for simplicity.
			executeBatch(keys, cacheKeys, resolvers, start, end, false)
		}
	}

	function executeBatch(
		keysArr: Key[],
		cacheKeysArr: string[],
		resolversArr: Resolver<Value>[],
		start: number,
		end: number,
		zeroCopy: boolean,
	): void {
		const length = end - start

		// Pass keys directly to the loader when the batch covers the whole array.
		const keys = zeroCopy ? keysArr : keysArr.slice(start, end)

		loader(keys).then(
			(results) => {
				for (let i = 0; i < length; i++) {
					const result = results[i]!
					const resolver = resolversArr[start + i]!
					if (result instanceof Error) {
						if (!cacheErrors) cacheMap?.delete(cacheKeysArr[start + i]!)
						resolver.reject(result)
					} else {
						resolver.resolve(result)
					}
				}
			},
			(error: unknown) => {
				const batchError = new BatchError(error as Error)
				for (let i = 0; i < length; i++) {
					const ri = start + i
					cacheMap?.delete(cacheKeysArr[ri]!)
					resolversArr[ri]!.reject(batchError)
				}
			},
		)
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
