import { memoize as fastMemoize } from "@formatjs/fast-memoize"
import { memoize as alleviateMemoize } from "alleviate"
// oxlint-disable-next-line e18e/ban-dependencies -- benchmark comparison
import lodashMemoize from "lodash.memoize"
import memoize from "memoize"
import memoizeOne from "memoize-one"
import { bench, describe } from "vitest"

const keys = Array.from({ length: 1_000 }, (_, index) => index.toString())

function identity(key: string) {
	return key
}

function slowObjectIdentity({ id }: { id: number }) {
	const end = performance.now() + 1
	while (performance.now() < end) {}
	return id
}

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

describe("create", () => {
	bench("memoize", () => {
		result = alleviateMemoize(identity)
	})
})

describe("memoize 1,000 different keys", () => {
	bench("memoize miss", () => {
		const cached = alleviateMemoize(identity)
		for (const key of keys) result = cached(key)
	})
})

describe("memoize 1,000 cached keys", () => {
	const cached = alleviateMemoize(identity)
	for (const key of keys) cached(key)

	bench("memoize hit", () => {
		for (const key of keys) result = cached(key)
	})
})

describe("memoize 1,000 keys with max", () => {
	bench("memoize max eviction", () => {
		const cached = alleviateMemoize(identity, { max: 100 })
		for (const key of keys) result = cached(key)
	})
})

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with popular memoize implementations",
	() => {
		bench("alleviate", () => {
			const cached = alleviateMemoize(identity)
			for (const key of keys) cached(key)
			for (const key of keys) result = cached(key)
		})

		bench("memoize", () => {
			const cached = memoize(identity)
			for (const key of keys) cached(key)
			for (const key of keys) result = cached(key)
		})

		bench("lodash.memoize", () => {
			const cached = lodashMemoize(identity)
			for (const key of keys) cached(key)
			for (const key of keys) result = cached(key)
		})

		bench("memoize-one", () => {
			const cached = memoizeOne(identity)
			for (const key of keys) cached(key)
			for (const key of keys) result = cached(key)
		})

		bench("@formatjs/fast-memoize", () => {
			const cached = fastMemoize(identity)
			for (const key of keys) cached(key)
			for (const key of keys) result = cached(key)
		})
	},
)

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare new objects with the same shape and a 1 ms function",
	() => {
		const alleviate = alleviateMemoize(slowObjectIdentity)
		const memoizePackage = memoize(slowObjectIdentity)
		const lodash = lodashMemoize(slowObjectIdentity)
		const memoizeOneCache = memoizeOne(slowObjectIdentity)
		const fast = fastMemoize(slowObjectIdentity)

		bench("alleviate", () => {
			result = alleviate({ id: 1 })
		})

		bench("memoize", () => {
			result = memoizePackage({ id: 1 })
		})

		bench("lodash.memoize", () => {
			result = lodash({ id: 1 })
		})

		bench("memoize-one", () => {
			result = memoizeOneCache({ id: 1 })
		})

		bench("@formatjs/fast-memoize", () => {
			result = fast({ id: 1 })
		})
	},
)
