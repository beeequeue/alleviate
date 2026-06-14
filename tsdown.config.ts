import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/index.ts"],
	outDir: "dist",
	exports: true,
	unbundle: true,

	env: {
		TEST: false,
	},

	platform: "node",
	format: "esm",
	dts: { oxc: true },
	fixedExtension: true,

	minify: "dce-only",
})
