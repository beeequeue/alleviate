type TTLMap<Key, Value> = {
	/** Check if a value exists in the Map. Does not affect TTL. */
	has(key: Key): boolean
	/** Get a value from the Map. Refreshes TTL unless `getRefreshesTTL` was set to `false`. */
	get(key: Key): Value | null
	/** Get a value from the Map. Never affects TTL. */
	peek(key: Key): Value | null
	/** Set a value in the Map. */
	set(key: Key, value: Value, ttl?: number): void
	/** Delete a value from the Map. */
	delete(key: Key): void
	/** Delete all values from the Map. */
	clear(): void
}

type TTLMapOptions = {
	ttl: number
	/** Whether getting a value from the map refreshes its TTL. Defaults to `true`. */
	getRefreshesTTL?: boolean
}

export function createTTLMap<Key, Value>(opts: TTLMapOptions): TTLMap<Key, Value> {
	const expiryMap = new Map<Key, number>()
	const dataMap = new Map<Key, Value>()

	setInterval(() => {
		for (const [key, expiresAt] of expiryMap) {
			if (expiresAt >= Date.now()) continue

			deleteKey(key)
		}
	}, 5000)

	function deleteKey(key: Key) {
		expiryMap.delete(key)
		dataMap.delete(key)
	}

	// returns true if expired or doesn't exist
	function handleExpired(key: Key): boolean {
		const expiresAt = expiryMap.get(key)
		if (expiresAt == null || expiresAt < Date.now()) {
			deleteKey(key)
			return true
		}
		return false
	}

	function has(key: Key): boolean {
		return !handleExpired(key)
	}

	function get(key: Key): Value | null {
		const expired = handleExpired(key)
		if (expired) return null
		if (opts.getRefreshesTTL !== false) {
			expiryMap.set(key, Date.now() + (expiryMap.get(key) ?? opts.ttl))
		}
		return dataMap.get(key) ?? null
	}

	function peek(key: Key): Value | null {
		if (handleExpired(key)) return null
		return !handleExpired(key) ? (dataMap.get(key) ?? null) : null
	}

	function set(key: Key, value: Value, ttl?: number) {
		expiryMap.set(key, Date.now() + (ttl ?? opts.ttl))
		dataMap.set(key, value)
	}

	function clear() {
		expiryMap.clear()
		dataMap.clear()
	}

	return {
		has,
		get,
		peek,
		set,
		delete: deleteKey,
		clear,
	} as const
}
