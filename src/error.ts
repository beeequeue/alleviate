export class TimeoutError extends Error {
	constructor(timeout: number) {
		super(`Promise timed out after ${timeout}ms.`)
	}
}
