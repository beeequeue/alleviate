export class TimeoutError extends Error {
	constructor(timeout: number) {
		super(`Promise timed out after ${timeout}ms.`)
	}
}

export class BatchError extends Error {
	constructor(cause: Error) {
		super(`Batch loader failed.`, { cause })
	}
}
