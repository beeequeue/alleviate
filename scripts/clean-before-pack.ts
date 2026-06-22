import fs from "node:fs"
import path from "node:path"

const readmePath = path.resolve(import.meta.dirname, "..", "README.md")
function cleanReadme() {
	const contents = fs.readFileSync(readmePath, "utf8")
	const lines = contents.split("\n")

	const regex = /^<!-- REMOVE (START|END) -->$/
	let isSkipping = false
	const newLines = lines.filter((line) => {
		const match = regex.exec(line)
		if (match != null) {
			isSkipping = match[1] === "START"
			return false
		}
		return !isSkipping
	})

	fs.writeFileSync(readmePath, newLines.join("\n"))
}

const manifestPath = path.resolve(import.meta.dirname, "..", "package.json")
const fieldsToDelete = [
	"scripts",
	"devDependencies",
	"lint-staged",
	"nano-staged",
	"simple-git-hooks",
]
function cleanManifest() {
	const contents = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

	for (const field of fieldsToDelete) {
		delete contents[field]
	}

	fs.writeFileSync(manifestPath, JSON.stringify(contents, null, 2))
}

cleanReadme()
cleanManifest()
