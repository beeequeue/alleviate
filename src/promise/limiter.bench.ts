import { createLimiter } from "alleviate"
import PQueue from "p-queue"
import { bench, describe } from "vitest"

const tasks = Array.from({ length: 1_000 }, (_, index) => async () => index)
const wrappedFn = async (n: number) => n

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

describe("create", () => {
	bench("createLimiter", () => {
		result = createLimiter({ concurrency: 4 })
	})
})

describe("run 1,000 tasks", () => {
	bench("createLimiter.run", async () => {
		const limiter = createLimiter({ concurrency: 4, pool: Infinity })
		await Promise.all(tasks.map((task) => limiter.run(task)))
	})
})

describe("run 1,000 tasks serially", () => {
	bench("createLimiter.run concurrency=1", async () => {
		const limiter = createLimiter({ concurrency: 1, pool: Infinity })
		await Promise.all(tasks.map((task) => limiter.run(task)))
	})
})

describe("wrap 1,000 tasks", () => {
	bench("createLimiter.wrap", async () => {
		const limiter = createLimiter({ concurrency: 4, pool: Infinity })
		const wrapped = limiter.wrap(wrappedFn)
		await Promise.all(tasks.map((_task, index) => wrapped(index)))
	})
})

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with p-queue",
	() => {
		bench("alleviate", async () => {
			const limiter = createLimiter({ concurrency: 4, pool: Infinity })
			await Promise.all(tasks.map((task) => limiter.run(task)))
		})

		bench("p-queue", async () => {
			const queue = new PQueue({ concurrency: 4 })
			await Promise.all(tasks.map((task) => queue.add(task)))
		})
	},
)
