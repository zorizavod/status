import assert from "node:assert/strict";
import { test } from "node:test";
import { parseHistory } from "../scripts/history-parser.mjs";
import {
	DAY,
	dayLabel,
	HOUR,
	historyFor,
	incidentsFor,
	intervalsFor,
	measure,
	PERIODS,
	periodWindow,
	validateData,
} from "../src/history.mjs";

const start = Date.parse("2026-10-30T21:00:00Z"); // 31 October 00:00 Moscow
const record = {
	start,
	observedUntil: start + HOUR,
	status: "up",
	events: [
		{ at: start, status: "up" },
		{ at: start + HOUR / 4, status: "down" },
		{ at: start + HOUR / 2, status: "up" },
	],
};
test("manual reference: 15 min down in 60 observed min gives 75%, unknown time excluded", () => {
	const result = measure(intervalsFor(record), start - DAY, start + 2 * HOUR);
	assert.equal(result.observed, HOUR);
	assert.equal(result.down, HOUR / 4);
	assert.equal(result.percent, 75);
	assert.equal(measure([], start, start + DAY).percent, null);
});
test("degraded intervals are observed but not counted as time without failures", () => {
	assert.equal(
		measure(
			[{ start, end: start + HOUR, status: "degraded" }],
			start,
			start + DAY,
		).percent,
		0,
	);
});
test("all five periods use Moscow boundaries and expected slot counts", () => {
	const now = start + HOUR;
	for (const period of PERIODS) {
		const history = historyFor(record, period, now, start);
		assert.equal(history.slots.length, period.key === "all" ? 1 : period.count);
		assert.match(history.caption, /75%/);
		assert.ok(
			history.slots.every((slot) => slot.end - slot.start === period.slotMs),
		);
	}
	assert.equal(dayLabel(start), "31 октября");
	assert.equal(periodWindow(PERIODS[4], now, start).start, start);
	assert.equal(periodWindow(PERIODS[4], now, start).end, start + DAY);
});
test("new probes have no invented percent or up slots; old periods show watch start", () => {
	const empty = historyFor(undefined, PERIODS[2], start + HOUR, start);
	assert.equal(empty.caption, null);
	assert.ok(empty.slots.every((slot) => slot.status === "unknown"));
	const year = historyFor(record, PERIODS[3], start + HOUR, start);
	assert.match(year.caption, /следим с 31 октября 2026/);
	assert.ok(year.slots.some((slot) => slot.status === "unknown"));
});
test("all-time grows by actual days, and clipping a partially observed slot is exact", () => {
	const period = PERIODS[4];
	assert.equal(
		historyFor(record, period, start + DAY + HOUR, start).slots.length,
		2,
	);
	const partial = measure(
		intervalsFor(record),
		start + 10 * 60_000,
		start + 20 * 60_000,
	);
	assert.equal(partial.observed, 10 * 60_000);
	assert.equal(partial.down, 5 * 60_000);
	assert.equal(partial.percent, 50);
});
test("incident list is empty without actual failures, contains real failure otherwise", () => {
	assert.equal(
		incidentsFor({ api: { ...record, events: [{ at: start, status: "up" }] } })
			.length,
		0,
	);
	const incidents = incidentsFor({ api: record });
	assert.equal(incidents.length, 1);
	assert.equal(incidents[0].start, start + HOUR / 4);
	assert.equal(incidents[0].ongoing, false);
});
test("patch parser carries state across unchanged context and preserves UTC timestamps", () => {
	const patches =
		"\x1e\n+status: up\n+lastUpdated: 2026-10-30T21:00:01Z\n\x1e\n status: up\n+status: down\n+lastUpdated: 2026-10-30T21:15:00Z\n\x1e\n status: down\n+lastUpdated: 2026-10-30T21:30:00Z\n\x1e\n+status: up\n+lastUpdated: 2026-10-30T22:00:00Z";
	const snapshot =
		"startTime: 2026-10-30T21:00:00Z\nstatus: up\nlastUpdated: 2026-10-30T22:00:00Z";
	const parsed = parseHistory(patches, snapshot);
	assert.equal(parsed.events.length, 3);
	assert.equal(parsed.start, start);
	assert.equal(measure(intervalsFor(parsed), start, start + HOUR).percent, 25);
});
test("malformed data and unordered timeline fail validation instead of green fallback", () => {
	assert.throws(() => validateData({}));
	assert.throws(() =>
		validateData({
			version: 1,
			generatedAt: start,
			checks: { api: { ...record, events: [...record.events].reverse() } },
		}),
	);
});

test("validation accepts actual monitored set and rejects unordered timeline in otherwise valid data", () => {
	const checks = Object.fromEntries(
		["mrp", "api", "database", "website", "docs"].map((slug) => [slug, record]),
	);
	const data = { version: 1, generatedAt: start + HOUR, checks };
	assert.equal(validateData(data), data);
	assert.throws(
		() =>
			validateData({
				...data,
				checks: {
					...checks,
					api: { ...record, events: [...record.events].reverse() },
				},
			}),
		/InvalidStatusEvent/,
	);
});
