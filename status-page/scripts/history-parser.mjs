// Only these public scalar fields are read. URLs, headers and any credentials are never exported.
export function parseSnapshot(text) {
	const result = {};
	for (const line of text.split("\n")) {
		const match = /^(status|lastUpdated|startTime): (.+)$/.exec(line);
		if (match) result[match[1]] = match[2].trim();
	}
	return result;
}
export function parseHistory(patches, snapshot) {
	const current = parseSnapshot(snapshot);
	const start = Date.parse(current.startTime);
	const observedUntil = Date.parse(current.lastUpdated);
	const events = [];
	let state;
	for (const patch of patches.split("\x1e")) {
		const added = patch
			.split("\n")
			.filter((line) => line.startsWith("+") && !line.startsWith("+++"))
			.map((line) => line.slice(1))
			.join("\n");
		const fields = parseSnapshot(added);
		if (fields.status) state = fields.status;
		const at = Date.parse(fields.lastUpdated);
		if (!state || !Number.isFinite(at)) continue;
		if (!events.length || events.at(-1).status !== state)
			events.push({ at: events.length ? at : start, status: state });
	}
	if (
		!events.length ||
		!Number.isFinite(start) ||
		!Number.isFinite(observedUntil)
	)
		throw new Error("IncompleteHistory");
	if (events.at(-1).status !== current.status)
		throw new Error("HistoryStatusMismatch");
	return { start, observedUntil, status: current.status, events };
}
