import { identify } from "object-identity"

type GenericSyncFn = (...args: any) => any

type MemoizeOptions<Fn extends GenericSyncFn> = {
	max?: number
	serialize?: (...args: Parameters<Fn>) => string
	keepNullish?: boolean
}

export function memoize<Fn extends GenericSyncFn>(fn: Fn, options?: MemoizeOptions<Fn>): Fn {
	type Return = ReturnType<Fn>

	const cache = new Map<string, Return>()

	function addToCache(serializedArgs: string, value: Return) {
		cache.set(serializedArgs, value)
		if (options?.max != null && cache.size > options.max) {
			cache.delete(cache.keys().next().value!)
		}
	}

	return ((...args) => {
		const serializedArgs =
			options?.serialize != null ? options.serialize(...(args as any)) : identify(args)

		if (cache.has(serializedArgs)) {
			const cached = cache.get(serializedArgs)
			if (cached != null || options?.keepNullish) {
				return cached
			}
		}

		const result = fn(...args)
		if (result instanceof Promise) {
			return new Promise<Return>((resolve, reject) => {
				result
					// oxlint-disable-next-line promise/always-return
					.then((value) => {
						if (value != null || options?.keepNullish) {
							addToCache(serializedArgs, value)
						}
						resolve(value)
					})
					.catch(reject)
			})
		}

		if (result != null || options?.keepNullish) {
			addToCache(serializedArgs, result)
		}
		return result
	}) as Fn
}
