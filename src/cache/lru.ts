// slightly modified version of https://github.com/lukeed/flru,
// the smallest and fastest LRU implementation i've benchmarked.
// see LICENSE-flru.md

export interface LRU<Key extends string, Value> {
	/** Check if key exists in cache */
	has(key: Key): boolean
	/** Get value from key without affecting LRU ordering */
	peek(key: Key): Value | null
	/** Get value from key, marking it as most recently used */
	get(key: Key): Value | null
	/** Add or update a key's value */
	set(key: Key, value: Value): void
	/** Adding or updating many keys' values at once */
	setMany(entries: Record<Key, Value> | Iterable<[Key, Value]>): void
	/** Remove all values */
	clear(): void
}

export interface LRUOptions {
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

	function get(key: Key): Value | null {
		let val = current[key]
		if (val != null) return val

		val = previous[key]
		if (val != null) {
			keep(key, val)
			return val
		}

		return null
	}

	function set(key: Key, value: Value): void {
		if (current[key] != null) {
			current[key] = value
		} else {
			keep(key, value)
		}
	}

	function setMany(input: Record<Key, Value> | Iterable<[Key, Value]>) {
		if ((input as any)?.[Symbol.iterator] != null) {
			for (const entry of input as Iterable<[Key, Value]>) {
				set(entry[0], entry[1])
			}
		} else {
			for (const key in input as Record<Key, Value>) {
				set(key, (input as Record<Key, Value>)[key])
			}
		}
	}

	return {
		clear: reset,
		has: (key) => current[key] != null || previous[key] != null,
		peek: (key) => current[key] ?? previous[key],
		get,
		set,
		setMany,
	}
}
