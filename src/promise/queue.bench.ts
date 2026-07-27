import { createQueue } from "alleviate"
import PQueue from "p-queue"
import { bench, describe } from "vitest"

const tasks = Array.from({ length: 1_000 }, (_, index) => async () => index)
const wrappedFn = async (n: number) => n

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

describe("create", () => {
	bench("createQueue", () => {
		result = createQueue({ concurrency: 4 })
	})
})

describe("run 1,000 tasks", () => {
	bench("createQueue.run", async () => {
		const queue = createQueue({ concurrency: 4 })
		await Promise.all(tasks.map((task) => queue.run(task)))
	})
})

describe("run 1,000 tasks serially", () => {
	bench("createQueue.run concurrency=1", async () => {
		const queue = createQueue({ concurrency: 1 })
		await Promise.all(tasks.map((task) => queue.run(task)))
	})
})

describe("wrap 1,000 tasks", () => {
	bench("createQueue.wrap", async () => {
		const queue = createQueue({ concurrency: 4 })
		const wrapped = queue.wrap(wrappedFn)
		await Promise.all(tasks.map((_task, index) => wrapped(index)))
	})
})

describe.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with p-queue",
	() => {
		bench("alleviate", async () => {
			const queue = createQueue({ concurrency: 4 })
			await Promise.all(tasks.map((task) => queue.run(task)))
		})

		bench("p-queue", async () => {
			const queue = new PQueue({ concurrency: 4 })
			await Promise.all(tasks.map((task) => queue.add(task)))
		})
	},
)
