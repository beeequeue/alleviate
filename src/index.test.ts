import assert from "node:assert"
import { describe, it } from "node:test"

import { hello } from "./index.ts"

void describe("test", () => {
	void it("test", () => {
		assert.equal(hello(), "world")
	})
})
