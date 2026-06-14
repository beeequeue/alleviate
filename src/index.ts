import pkgJson from "@beequeue/project-template/package.json" with { type: "json" }

export const hello = (): string => {
	console.log("hello world:", pkgJson.version)
	return "world"
}
