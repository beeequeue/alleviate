// oxlint-disable vitest/expect-expect
import { createQueue } from "alleviate"
import PQueue from "p-queue"
import { test } from "vitest"

const tasks = Array.from({ length: 1_000 }, (_, index) => async () => index)
const wrappedFn = async (n: number) => n

// @ts-expect-error: unused, but needed for deoptimization
// oxlint-disable-next-line no-unused-vars
var result: any

test("create", async ({ bench }) => {
	await bench("createQueue", () => {
		result = createQueue({ concurrency: 4 })
	}).run()
})

test("run 1,000 tasks", async ({ bench }) => {
	await bench("createQueue.run", async () => {
		const queue = createQueue({ concurrency: 4 })
		await Promise.all(tasks.map((task) => queue.run(task)))
	}).run()
})

test("run 1,000 tasks serially", async ({ bench }) => {
	await bench("createQueue.run concurrency=1", async () => {
		const queue = createQueue({ concurrency: 1 })
		await Promise.all(tasks.map((task) => queue.run(task)))
	}).run()
})

test("wrap 1,000 tasks", async ({ bench }) => {
	await bench("createQueue.wrap", async () => {
		const queue = createQueue({ concurrency: 4 })
		const wrapped = queue.wrap(wrappedFn)
		await Promise.all(tasks.map((_task, index) => wrapped(index)))
	}).run()
})

test.skipIf(process.env.CODSPEED != null || process.env.CODSPEED_RUNNER_MODE != null)(
	"compare with p-queue",
	async ({ bench }) => {
		await bench.compare(
			bench("alleviate", async () => {
				const queue = createQueue({ concurrency: 4 })
				await Promise.all(tasks.map((task) => queue.run(task)))
			}),
			bench("p-queue", async () => {
				const queue = new PQueue({ concurrency: 4 })
				await Promise.all(tasks.map((task) => queue.add(task)))
			}),
		)
	},
)
