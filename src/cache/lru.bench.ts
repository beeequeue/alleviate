// oxlint-disable vitest/expect-expect
import { it } from "vitest"

import { createLRU } from "./lru.ts"

const generateValue = (uuids = 1) => {
	let str = ""
	for (let i = 0; i < uuids; i++) {
		str += crypto.randomUUID()
	}
	return str
}

it("createLRU()", async ({ bench }) => {
	const lru = createLRU({ max: 10_000 })
	const keys: string[] = []
	for (let i = 0; i < 10_000; i++) {
		lru.set(crypto.randomUUID(), generateValue(3))
	}

	await bench("get 100 items", async () => {
		let v
		for (let i = 0; i < 100; i++) {
			v = lru.get(keys[i]!)
		}

		return v
	}).run()

	await bench("get 10_000 items", async () => {
		let v
		for (let i = 0; i < 10_000; i++) {
			v = lru.get(keys[i]!)
		}

		return v
	}).run()

	await bench("get 10_000 non-existant", async () => {
		let v
		for (let i = 0; i < 10_000; i++) {
			v = lru.get(i.toString())
		}

		return v
	}).run()

	await bench("has 10_000", async () => {
		let v
		for (let i = 0; i < 10_000; i++) {
			v = lru.has(keys[i]!)
		}

		return v
	}).run()

	await bench("set 5000", async () => {
		for (let i = 0; i < 5_000; i++) {
			lru.set(keys[i]!, i.toString())
		}

		return lru
	}).run()

	const evictionLru = createLRU({ max: 1000 })
	await bench("set 5000 with max=1000", async () => {
		for (let i = 0; i < 5_000; i++) {
			evictionLru.set(keys[i]!, i.toString())
		}

		return evictionLru
	}).run()
})
