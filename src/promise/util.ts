import { TimeoutError } from "../error.ts"

export function timeoutPromise(ms: number): Promise<never> {
	return new Promise((_, reject) => reject(new TimeoutError(ms)))
}

export type GenericFn = (...args: any) => Promise<any>

export type QueueItem = {
	fn: GenericFn
	resolve: (value: any) => void
	reject: (error: unknown) => void
}
