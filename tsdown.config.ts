import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/index.ts", "src/cache/lru.ts"],
	outDir: "dist",
	exports: true,
	fixedExtension: true,

	env: { TEST: false },

	format: "esm",
	platform: "node",
	minify: "dce-only",
	dts: { oxc: true },
	unbundle: true,
	outputOptions: {
		comments: { jsdoc: false }, // removes jsdoc comments from JS output, keeps them in TS
	},
})
