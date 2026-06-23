type GenericSyncFn = (...args: any) => any

function isPrimitive(
	input: unknown,
): input is boolean | string | number | bigint | null | undefined {
	return (
		typeof input === "boolean" ||
		typeof input === "string" ||
		typeof input === "number" ||
		typeof input === "bigint" ||
		input == null
	)
}

const sep = "-||-"

function defaultParameterSerializer(params: unknown[]): string {
	const allPrimitives = params.every(isPrimitive)
	if (allPrimitives) {
		return params.join(sep)
	}

	return params
		.map((param) => {
			if (isPrimitive(param)) {
				return param.toString()
			}

			return JSON.stringify(param)
		})
		.join(sep)
}

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
			options?.serialize?.(...(args as any)) ?? defaultParameterSerializer(args)

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
