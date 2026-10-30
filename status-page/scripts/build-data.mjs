import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateData } from "../src/history.mjs";
import { parseHistory } from "./history-parser.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const slugs = [
	"mrp",
	"api",
	"database",
	"website",
	"docs",
	"developer",
	"external-api",
];
try {
	const summary = JSON.parse(
		readFileSync(`${root}/history/summary.json`, "utf8"),
	);
	const checks = {};
	for (const slug of slugs) {
		let snapshot;
		try {
			snapshot = readFileSync(`${root}/history/${slug}.yml`, "utf8");
		} catch (error) {
			if (
				error.code === "ENOENT" &&
				["developer", "external-api"].includes(slug)
			)
				continue;
			throw error;
		}
		if (
			!summary.some((check) => check.slug === slug) &&
			!["developer", "external-api"].includes(slug)
		)
			throw new Error("MissingSummary");
		const patches = execFileSync(
			"git",
			[
				"log",
				"--reverse",
				"--format=format:%x1e",
				"-p",
				"--",
				`history/${slug}.yml`,
			],
			{ cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
		);
		checks[slug] = parseHistory(patches, snapshot);
	}
	const revision = execFileSync("git", ["rev-parse", "HEAD"], {
		cwd: root,
		encoding: "utf8",
	}).trim();
	const data = validateData({
		version: 1,
		generatedAt: Date.now(),
		revision,
		checks,
	});
	writeFileSync(
		new URL("../public/data.json", import.meta.url),
		JSON.stringify(data),
	);
	console.log(
		`Public history: ${Object.keys(checks).length} checks, revision ${revision}`,
	);
} catch (error) {
	console.error("Public history generation failed:", error.name);
	process.exitCode = 1;
}
