import PQueue from "p-queue"
// oxlint-disable vitest/expect-expect
import { it } from "vitest"

import { createQueue } from "./queue.ts"

const generateValue = () => Math.random() * 10_000

it("simple queue with 3 concurrent functions", async ({ bench }) => {
	await bench.compare(
		bench("createQueue", async () => {
			const queue = createQueue({ concurrency: 3 })
			const promises: Promise<number>[] = []
			for (let i = 0; i < 5; i++) {
				promises.push(queue.run(async () => generateValue()))
			}

			return Promise.all(promises)
		}),
		bench("p-queue", async () => {
			const queue = new PQueue({ concurrency: 3 })
			const promises: Promise<number>[] = []
			for (let i = 0; i < 5; i++) {
				promises.push(queue.add(async () => generateValue()))
			}

			return Promise.all(promises)
		}),
	)
})
