import { useState } from "react";
import type { StatusData } from "./App";
import { BRAND, CHECKS, type Check, INK } from "./content";
import { historyFor, incidentsFor, slotLabel } from "./history.mjs";
export const statusColor = (status: string) =>
	status === "up"
		? BRAND
		: status === "down"
			? "var(--status-red)"
			: status === "degraded"
				? "var(--status-yellow)"
				: "#cbd5e1";
export const overallLabel = (status: string) =>
	status === "up"
		? "Все работает"
		: status === "down"
			? "Есть сбой, мы уже чиним"
			: status === "degraded"
				? "Работает медленно"
				: "Загружаем";
const rowLabel = (status: string) =>
	status === "up"
		? "Работает"
		: status === "down"
			? "Не работает"
			: status === "degraded"
				? "Работает медленно"
				: "тогда мы еще не следили";
function HistoryBar({ record, period, now, firstStart, name }) {
	const history = historyFor(record, period, now, firstStart);
	const [hint, setHint] = useState<{
		text: string;
		x: number;
		y: number;
	} | null>(null);
	function show(event, text: string) {
		const rect = event.currentTarget.getBoundingClientRect();
		setHint({
			text,
			x: Math.max(12, Math.min(rect.left - 120, window.innerWidth - 312)),
			y: Math.max(12, Math.min(rect.bottom + 10, window.innerHeight - 96)),
		});
	}
	return (
		<div className="relative mt-3">
			<fieldset
				className="flex min-w-0 h-[34px] gap-px sm:gap-[2px]"
				aria-label={`История проверки «${name}» ${period.uptimeTail}`}
			>
				{history.slots.map((slot) => (
					<button
						type="button"
						key={slot.start}
						aria-label={slot.hint}
						onMouseEnter={(event) => show(event, slot.hint)}
						onFocus={(event) => show(event, slot.hint)}
						onClick={(event) => show(event, slot.hint)}
						onMouseLeave={() => setHint(null)}
						onBlur={() => setHint(null)}
						onKeyDown={(event) => {
							if (event.key === "Escape") setHint(null);
						}}
						className="min-w-0 flex-1 rounded-[1px] focus-visible:outline-2 focus-visible:outline-offset-2"
						style={{ backgroundColor: statusColor(slot.status) }}
					/>
				))}
			</fieldset>
			{hint && (
				<div
					role="tooltip"
					className="fixed z-10 w-[300px] max-w-[calc(100vw-24px)] rounded-md px-3 py-2 text-xs font-medium text-white shadow-lg"
					style={{ left: hint.x, top: hint.y, backgroundColor: INK }}
				>
					{hint.text}
				</div>
			)}
			<div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
				<span className="shrink-0">{history.leftLabel}</span>
				<span className="h-px flex-1 bg-slate-200" />
				{history.caption && (
					<>
						<span className="shrink-0 max-sm:hidden">{history.caption}</span>
						<span className="h-px flex-1 bg-slate-200 max-sm:hidden" />
					</>
				)}
				<span className="shrink-0">сегодня</span>
			</div>
			<p className="mt-1 min-h-4 text-xs text-slate-500 sm:hidden">
				{history.caption ?? "\u00a0"}
			</p>
		</div>
	);
}
export function CheckRow({
	check,
	record,
	period,
	now,
	firstStart,
	loading,
	error,
}: {
	check: Check;
	record: StatusData["checks"][string] | undefined;
	period: typeof import("./history.mjs").PERIODS[number];
	now: number;
	firstStart: number;
	loading: boolean;
	error: boolean;
}) {
	const status = record?.status ?? "unknown";
	return (
		<li className="px-4 py-5 sm:px-5" data-check={check.slug}>
			<div className="flex items-start justify-between gap-4">
				<h3
					className="min-w-0 flex-1 text-comfort font-semibold leading-snug"
					style={{ color: INK }}
				>
					{check.name}
				</h3>
				<span
					className="flex max-w-[55%] shrink-0 items-center gap-2 text-sm font-semibold"
					style={{ color: status === "up" ? "#0A7269" : INK }}
				>
					<span
						aria-hidden
						className="inline-block size-2 shrink-0 rounded-full"
						style={{ backgroundColor: statusColor(status) }}
					/>
					{loading ? "Загружаем" : error ? "" : rowLabel(status)}
				</span>
			</div>
			<p className="mt-1 max-w-[640px] text-sm leading-snug text-slate-500">
				{check.note}
			</p>
			<HistoryBar
				record={record}
				period={period}
				now={now}
				firstStart={firstStart}
				name={check.name}
			/>
		</li>
	);
}
export function Incidents({ checks }: { checks: StatusData["checks"] }) {
	const incidents = incidentsFor(checks);
	const active = incidents.filter((incident) => incident.ongoing);
	const past = incidents.filter((incident) => !incident.ongoing);
	function list(items) {
		return (
			<ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
				{items.map((incident) => (
					<li className="p-5" key={`${incident.slug}-${incident.start}`}>
						<h3 className="font-semibold">
							{CHECKS.find((check) => check.slug === incident.slug)?.name}
						</h3>
						<p className="mt-1 text-sm text-slate-600">
							{slotLabel(incident.start, incident.end)} ·{" "}
							{incident.ongoing ? "Идет сейчас" : "Исправлен"}
						</p>
					</li>
				))}
			</ul>
		);
	}
	return (
		<>
			{active.length > 0 && (
				<section className="pt-14">
					<h2 className="text-xl font-bold">Сейчас есть сбой</h2>
					{list(active)}
				</section>
			)}
			{past.length > 0 && (
				<section className="pt-14">
					<h2 className="text-xl font-bold">Прошлые сбои</h2>
					{list(past)}
				</section>
			)}
		</>
	);
}
