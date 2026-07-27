import codspeedPlugin from "@codspeed/vitest-plugin"
import { defineConfig } from "vitest/config"

const codspeed = codspeedPlugin()

// In vitest v5 the mode is always "test", but the codspeed plugin checks for
// "benchmark" and skips itself. Override apply so it activates in v5.
codspeed.apply = (_, { mode }) => mode === "test" || mode === "benchmark"

// In v5 the plugin's globalSetup runs for every project (test + bench),
// causing "teardown called twice" on close. The globalSetup only logs
// setup/teardown, so remove it by intercepting the config hook.
const originalConfig = codspeed.config as unknown as (
	...args: unknown[]
) => { test?: { globalSetup?: unknown[] } } | undefined
codspeed.config = ((...args: Parameters<typeof originalConfig>) => {
	const c = originalConfig(...args)
	if (c?.test) {
		c.test.globalSetup = []
	}
	return c
}) as typeof codspeed.config

export default defineConfig({
	test: {
		testTimeout: 1500,
		experimental: { preParse: true, viteModuleRunner: false },
		env: { NODE_ENV: "test" },
		mockReset: true,
		restoreMocks: true,
	},

	plugins: [codspeed],
})
