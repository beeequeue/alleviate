import { identify } from "object-identity"

import { TimeoutError } from "./error.ts"

export function serializeUnknown(value: unknown): unknown {
	return typeof value === "object" && value != null ? identify(value) : value
}

export function timeoutPromise(ms: number): { cancel: () => void; promise: Promise<never> } {
	let cancel!: () => void

	const promise = new Promise<never>((_, reject) => {
		const timeout = setTimeout(() => {
			reject(new TimeoutError(ms))
		}, ms)

		cancel = () => clearTimeout(timeout)
	})

	return { cancel, promise }
}

export type GenericFn = (...args: any) => Promise<any>

export type QueueItem = {
	fn: GenericFn
	resolve: (value: any) => void
	reject: (error: unknown) => void
}
