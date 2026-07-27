import codspeed from "@codspeed/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
	test: {
		testTimeout: 1500,
		experimental: { viteModuleRunner: false },
		env: { NODE_ENV: "test" },
		mockReset: true,
		restoreMocks: true,
	},

	plugins: [codspeed()],
})
