// slightly modified version of https://github.com/lukeed/flru,
// the smallest and fastest LRU implementation i've benchmarked.
// see LICENSE-flru.md

type LRU<K, V> = {
	size: number
	has(key: K): boolean
	get(key: K): V | null
	set(key: K, value: V): void
	clear(): void
}

type LRUOptions = {
	max?: number
}

export function createLRU<Key extends string, Value>(opts: LRUOptions = {}): LRU<Key, Value> {
	// using var instead of const/let here results in measurable perf imrovements
	var size = 0
	var current: Record<Key, Value> = Object.create(null)
	var previous: Record<Key, Value> = Object.create(null)
	var limit = opts.max ?? 1

	function reset(isPartial?: boolean) {
		size = 0
		current = Object.create(null)
		if (!isPartial) {
			previous = Object.create(null)
		}
	}

	function keep(key: Key, value: Value) {
		if (++size > limit) {
			previous = current
			reset(true)
			++size
		}
		current[key] = value
	}

	return {
		get size() {
			return size
		},
		clear: reset,
		has: (key: Key): boolean => current[key] != null || previous[key] != null,
		get: (key: Key): Value | null => {
			let val = current[key]
			if (val != null) return val
			if ((val = previous[key]) != null) {
				keep(key, val)
				return val
			}
			return null
		},
		set: (key, value) => {
			if (current[key] != null) {
				current[key] = value
			} else {
				keep(key, value)
			}
		},
	}
}
