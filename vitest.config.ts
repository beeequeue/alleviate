import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		experimental: { preParse: true, viteModuleRunner: false },
		env: { NODE_ENV: "test" },
		mockReset: true,
		restoreMocks: true,
	},
})
