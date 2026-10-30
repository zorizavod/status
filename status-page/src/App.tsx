import { useEffect, useState } from "react";
import { CHECKS, FOOTER_LINKS, HEADER_LINKS, INK, SITE_FONT } from "./content";
import { PERIODS, validateData } from "./history.mjs";
import {
	CheckRow,
	Incidents,
	overallLabel,
	statusColor,
} from "./StatusHistory";

type PeriodKey = "day" | "week" | "month" | "year" | "all";
interface RecordData {
	start: number;
	observedUntil: number;
	status: string;
	events: { at: number; status: string }[];
}
export interface StatusData {
	version: number;
	generatedAt: number;
	revision: string;
	checks: Record<string, RecordData>;
}
function readInitialPeriod(): PeriodKey {
	const value = new URLSearchParams(window.location.search).get("period");
	return PERIODS.some((period) => period.key === value)
		? (value as PeriodKey)
		: "month";
}
export default function App() {
	const [periodKey, setPeriodKey] = useState<PeriodKey>(readInitialPeriod);
	const [data, setData] = useState<StatusData | null>(null);
	const [error, setError] = useState(false);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		const controller = new AbortController();
		async function load() {
			try {
				const response = await fetch("/data.json", {
					signal: controller.signal,
					cache: "no-store",
				});
				if (!response.ok) throw new Error("StatusFetchFailed");
				const next = validateData(await response.json());
				if (!controller.signal.aborted) {
					setData(next);
					setError(false);
				}
			} catch {
				if (!controller.signal.aborted) {
					setData(null);
					setError(true);
				}
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		}
		void load();
		return () => controller.abort();
	}, []);
	const period = PERIODS.find((item) => item.key === periodKey) ?? PERIODS[2];
	const now = Date.now();
	const starts = data
		? Object.values(data.checks).map((check) => check.start)
		: [];
	const firstStart = starts.length ? Math.min(...starts) : now;
	const states = data
		? Object.values(data.checks).map((check) => check.status)
		: [];
	const overall = states.includes("down")
		? "down"
		: states.includes("degraded")
			? "degraded"
			: states.length
				? "up"
				: "unknown";
	function changePeriod(key: string) {
		setPeriodKey(key as PeriodKey);
		const url = new URL(window.location.href);
		url.searchParams.set("period", key);
		window.history.replaceState(null, "", url);
	}
	return (
		<div
			className="min-h-screen bg-white text-slate-900 antialiased"
			style={{ fontFamily: SITE_FONT }}
		>
			<header className="border-b border-slate-100 bg-white/80 backdrop-blur-md">
				<div className="mx-auto flex max-w-[880px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 sm:h-16 sm:py-0">
					<a
						href="https://zolotenkov.ru/"
						aria-label="Золотенков МРП"
						className="flex items-center"
					>
						<img
							src="/logo.svg"
							alt="Золотенков МРП"
							width={174}
							height={32}
							className="h-8 w-auto"
						/>
					</a>
					<nav className="-mx-3 flex flex-wrap items-center max-sm:w-full">
						{HEADER_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 transition-colors hover:text-[#0A7269]"
							>
								{link.label}
							</a>
						))}
					</nav>
				</div>
			</header>

			<main className="mx-auto max-w-[880px] px-6">
				<section className="pt-12 sm:pt-16">
					<h1
						className="text-3xl font-bold leading-tight sm:text-4xl"
						style={{ color: INK }}
					>
						Работает ли Золотенков МРП
					</h1>
					<p className="mt-4 max-w-[640px] text-base leading-relaxed text-slate-600 sm:text-lg">
						Здесь видно, открывается ли программа и сохраняются ли данные прямо
						сейчас. Мы проверяем это несколько раз в час с отдельного сервера,
						поэтому страница работает даже при нашей аварии.
					</p>
					<div
						className="mt-8 flex items-center gap-3 rounded-xl px-5 py-4 text-lg font-bold text-white"
						style={{ backgroundColor: data ? statusColor(overall) : "#64748b" }}
					>
						<span
							aria-hidden
							className="inline-block size-2.5 rounded-full bg-white"
						/>
						{error
							? "Не получилось показать состояние"
							: loading
								? "Загружаем"
								: overallLabel(overall)}
					</div>
				</section>

				<section className="pt-14">
					<div className="flex flex-wrap items-end justify-between gap-4">
						<h2 className="text-xl font-bold" style={{ color: INK }}>
							Что работает сейчас
						</h2>
						<div
							role="tablist"
							aria-label="Период истории"
							className="flex rounded-lg border border-slate-200 bg-white p-1 max-sm:w-full"
						>
							{PERIODS.map((p) => (
								<button
									key={p.key}
									type="button"
									role="tab"
									aria-selected={p.key === period.key}
									onClick={() => changePeriod(p.key)}
									className={`flex-auto whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition-colors max-sm:px-1 max-sm:text-compact ${p.key === period.key ? "text-white" : "text-slate-600 hover:text-slate-900"}`}
									style={
										p.key === period.key ? { backgroundColor: INK } : undefined
									}
								>
									{p.label}
								</button>
							))}
						</div>
					</div>

					<ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200">
						{CHECKS.map((check) => (
							<CheckRow
								key={check.slug}
								check={check}
								record={data?.checks[check.slug]}
								period={period}
								now={now}
								firstStart={firstStart}
								loading={loading}
								error={error}
							/>
						))}
					</ul>
				</section>

				{error && (
					<div
						role="alert"
						className="mt-6 rounded-xl border border-slate-200 p-5"
					>
						<p>Страница не смогла получить свежие данные о проверках.</p>
						<p>
							Обновите страницу через минуту. Если не поможет, напишите нам в
							Telegram.
						</p>
						<a href="/" className="mt-3 inline-block underline">
							На главную
						</a>
					</div>
				)}
				{data && <Incidents checks={data.checks} />}
				<section className="py-14">
					<div className="rounded-2xl bg-[#FAFAF7] px-6 py-8 sm:px-10 sm:py-10">
						<h2
							className="text-2xl font-bold leading-tight"
							style={{ color: INK }}
						>
							Видите сбой, а здесь все зеленое?
						</h2>
						<p className="mt-3 max-w-[600px] text-base leading-relaxed text-slate-600">
							Напишите нам, мы проверим. Часто дело в сети или у провайдера, но
							мы хотим знать о каждом случае. Опишите, что не открывается, и
							пришлите снимок экрана, так разберемся быстрее.
						</p>
						<div className="mt-6 flex flex-wrap gap-3 max-sm:flex-col">
							<a
								href="https://t.me/zolotenkova_mrp"
								className="inline-flex items-center justify-center gap-2 rounded-lg border-2 border-[#1F2024] bg-[#D8FF54] px-6 py-3 text-center font-bold text-[#1F2024] shadow-[0_4px_0_#1F2024] transition-colors hover:bg-[#C7EE3D]"
							>
								Написать в Telegram
							</a>
							<a
								href="mailto:svetlana@zolotenkov.ru"
								className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-[#1F2024] bg-white px-6 py-3 text-center font-bold text-[#1F2024] transition-colors hover:bg-stone-50"
							>
								svetlana@zolotenkov.ru
							</a>
						</div>
					</div>
				</section>
			</main>

			<footer className="bg-[#15161A] text-stone-300">
				<div className="mx-auto max-w-[880px] px-6 py-10 text-sm leading-relaxed">
					<p className="font-semibold text-white">
						Золотенков МРП. Помощник для учета и планирования производства,
						заказов и закупок.
					</p>
					<p className="mt-2 text-stone-400">
						Проверки идут несколько раз в час с отдельного сервера, поэтому
						короткий сбой может сюда не попасть.
					</p>
					<nav className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
						{FOOTER_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								className="text-stone-300 transition-colors hover:text-white"
							>
								{link.label}
							</a>
						))}
					</nav>
				</div>
			</footer>
		</div>
	);
}
