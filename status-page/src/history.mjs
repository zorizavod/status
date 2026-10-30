export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
const MOSCOW_OFFSET = 3 * HOUR;
export const PERIODS = [
	{
		key: "day",
		label: "Сутки",
		slotMs: HOUR / 4,
		count: 96,
		leftLabel: "сутки назад",
		uptimeTail: "за сутки",
	},
	{
		key: "week",
		label: "7 дней",
		slotMs: 2 * HOUR,
		count: 84,
		leftLabel: "7 дней назад",
		uptimeTail: "за 7 дней",
	},
	{
		key: "month",
		label: "30 дней",
		slotMs: 8 * HOUR,
		count: 90,
		leftLabel: "30 дней назад",
		uptimeTail: "за 30 дней",
	},
	{
		key: "year",
		label: "Год",
		slotMs: 5 * DAY,
		count: 73,
		leftLabel: "год назад",
		uptimeTail: "за год",
	},
	{
		key: "all",
		label: "Все время",
		slotMs: DAY,
		count: 0,
		leftLabel: "",
		uptimeTail: "за все время",
	},
];
export const dayLabel = (at) =>
	new Intl.DateTimeFormat("ru-RU", {
		timeZone: "Europe/Moscow",
		day: "numeric",
		month: "long",
	}).format(at);
export const fullDate = (at) =>
	new Intl.DateTimeFormat("ru-RU", {
		timeZone: "Europe/Moscow",
		day: "numeric",
		month: "long",
		year: "numeric",
	})
		.format(at)
		.replace(" г.", "");
const clock = (at) =>
	new Intl.DateTimeFormat("ru-RU", {
		timeZone: "Europe/Moscow",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(at);
export function slotLabel(start, end) {
	if (end - start < DAY)
		return `${dayLabel(start)}, ${clock(start)}–${clock(end) === "00:00" ? "24:00" : clock(end)}`;
	if (end - start === DAY) return dayLabel(start);
	return `${dayLabel(start)} – ${dayLabel(end - DAY)}`;
}
export function periodWindow(period, now, firstStart) {
	// All calendar days end at midnight in Moscow, not UTC.
	const step = period.key === "year" ? DAY : period.slotMs;
	const end =
		(period.slotMs >= DAY
			? Math.floor((now + MOSCOW_OFFSET) / step) + 1
			: Math.ceil((now + MOSCOW_OFFSET) / step)) *
			step -
		MOSCOW_OFFSET;
	const firstDay =
		Math.floor(((firstStart ?? now) + MOSCOW_OFFSET) / DAY) * DAY -
		MOSCOW_OFFSET;
	const count =
		period.key === "all"
			? Math.max(1, Math.ceil((end - firstDay) / DAY))
			: period.count;
	return { start: end - count * period.slotMs, end, count };
}
export function intervalsFor(check) {
	if (!check?.events?.length) return [];
	return check.events
		.map((event, i) => ({
			start: event.at,
			end: check.events[i + 1]?.at ?? check.observedUntil,
			status: event.status,
		}))
		.filter((interval) => interval.end >= interval.start);
}
export function measure(intervals, start, end) {
	let observed = 0,
		down = 0,
		degraded = 0;
	for (const interval of intervals) {
		const overlap = Math.max(
			0,
			Math.min(end, interval.end) - Math.max(start, interval.start),
		);
		observed += overlap;
		if (interval.status === "down") down += overlap;
		if (interval.status === "degraded") degraded += overlap;
	}
	return {
		observed,
		down,
		degraded,
		percent: observed ? ((observed - down - degraded) / observed) * 100 : null,
	};
}
export function historyFor(check, period, now, firstStart) {
	const window = periodWindow(period, now, firstStart);
	const intervals = intervalsFor(check);
	const slots = Array.from({ length: window.count }, (_, index) => {
		const start = window.start + index * period.slotMs;
		const end = start + period.slotMs;
		const stats = measure(intervals, start, Math.min(now, end));
		const status = stats.down
			? "down"
			: stats.degraded
				? "degraded"
				: stats.observed
					? "up"
					: "unknown";
		const hint =
			status === "unknown"
				? "тогда мы еще не следили"
				: stats.down
					? `не работал ${Math.ceil(stats.down / 60_000)} минут`
					: stats.degraded
						? "работал медленно"
						: "работал без сбоев";
		return { start, end, status, hint: `${slotLabel(start, end)}, ${hint}` };
	});
	const stats = measure(intervals, window.start, Math.min(now, window.end));
	const percent =
		stats.percent === null
			? null
			: new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(
					stats.percent,
				);
	const tail =
		check?.start && check.start > window.start
			? `, следим с ${fullDate(check.start)}`
			: ` ${period.uptimeTail}`;
	return {
		slots,
		caption: percent === null ? null : `Работал ${percent}% времени${tail}`,
		leftLabel: period.key === "all" ? fullDate(window.start) : period.leftLabel,
	};
}
export function incidentsFor(checks) {
	return Object.entries(checks)
		.flatMap(([slug, check]) =>
			intervalsFor(check)
				.filter((interval) => interval.status !== "up")
				.map((interval) => ({
					...interval,
					slug,
					ongoing:
						interval.end === check.observedUntil && check.status !== "up",
				})),
		)
		.sort((a, b) => b.start - a.start);
}
export function validateData(data) {
	if (
		data?.version !== 1 ||
		!Number.isFinite(data.generatedAt) ||
		!data.checks ||
		typeof data.checks !== "object"
	)
		throw new Error("InvalidStatusData");
	for (const slug of ["mrp", "api", "database", "website", "docs"]) {
		if (!data.checks[slug]) throw new Error("MissingStatusCheck");
	}
	const states = ["up", "down", "degraded"];
	for (const check of Object.values(data.checks)) {
		if (
			!states.includes(check.status) ||
			!Number.isFinite(check.start) ||
			!Number.isFinite(check.observedUntil) ||
			!Array.isArray(check.events) ||
			!check.events.length
		)
			throw new Error("InvalidStatusCheck");
		let previous = check.start - 1;
		for (const event of check.events) {
			if (
				!Number.isFinite(event.at) ||
				event.at <= previous ||
				event.at > check.observedUntil ||
				!states.includes(event.status)
			)
				throw new Error("InvalidStatusEvent");
			previous = event.at;
		}
	}
	return data;
}
