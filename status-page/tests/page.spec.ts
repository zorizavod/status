import { expect, test } from "@playwright/test";

const now = Date.parse("2026-10-31T12:00:00Z");
const start = now - 10 * 86_400_000;
const slugs = ["mrp", "api", "database", "website", "docs"];
const record = {
	start,
	observedUntil: now,
	status: "up",
	events: [{ at: start, status: "up" }],
};
const fixture = {
	version: 1,
	generatedAt: now,
	revision: "test",
	checks: Object.fromEntries(slugs.map((slug) => [slug, record])),
};
test.beforeEach(async ({ page }) => {
	await page.clock.setFixedTime(now);
});
test("all periods, Moscow dates, two new probes, growing history and links", async ({
	page,
}) => {
	await page.route("**/data.json", (route) => route.fulfill({ json: fixture }));
	await page.goto("/?period=invalid");
	await expect(
		page.getByRole("tab", { name: "30 дней", exact: true }),
	).toHaveAttribute("aria-selected", "true");
	await expect(page.getByText("Все работает", { exact: true })).toBeVisible();
	await expect(page.locator("[data-check]")).toHaveCount(7);
	await expect(page.locator('[data-check="developer"]')).not.toContainText(
		"100%",
	);
	await expect(page.getByRole("heading", { name: "Прошлые сбои" })).toHaveCount(
		0,
	);
	const cases: [string, string, number][] = [
		["Сутки", "day", 96],
		["7 дней", "week", 84],
		["30 дней", "month", 90],
		["Год", "year", 73],
		["Все время", "all", 11],
	];
	for (const [label, key, count] of cases) {
		await page.getByRole("tab", { name: label, exact: true }).click();
		await expect(
			page.locator('[data-check="api"] fieldset button'),
		).toHaveCount(count);
		await expect(page).toHaveURL(new RegExp(`period=${key}`));
		await expect(page.locator('[data-check="api"]')).toContainText("100%");
	}
	await expect(
		page.getByRole("link", { name: "Написать в Telegram", exact: true }),
	).toHaveAttribute("href", "https://t.me/zolotenkova_mrp");
	await expect(
		page.getByRole("link", { name: "GitHub", exact: true }),
	).toHaveCount(0);
});
test("loading preserves seven rows, fetch error never renders up or 100%, reload retries", async ({
	page,
}) => {
	let release: () => void = () => {};
	const held = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/data.json", async (route) => {
		await held;
		await route.fulfill({ status: 503, body: "" });
	});
	await page.goto("/");
	await expect(page.locator("[data-check]")).toHaveCount(7);
	await expect(
		page.getByText("Загружаем", { exact: true }).first(),
	).toBeVisible();
	await expect(page.getByText("Все работает", { exact: true })).toHaveCount(0);
	release();
	await expect(page.getByRole("alert")).toContainText(
		"Страница не смогла получить свежие данные",
	);
	await expect(page.getByText(/100%/)).toHaveCount(0);
	await expect(
		page.getByRole("link", { name: "Написать в Telegram", exact: true }),
	).toBeVisible();
	await page.unroute("**/data.json");
	await page.route("**/data.json", (route) => route.fulfill({ json: fixture }));
	await page.getByRole("link", { name: "На главную", exact: true }).click();
	await expect(page.getByText("Все работает", { exact: true })).toBeVisible();
});
test("actual failure appears in overall status, affected check and incident list", async ({
	page,
}) => {
	const failed = {
		...record,
		status: "down",
		events: [...record.events, { at: now - 15 * 60_000, status: "down" }],
	};
	await page.route("**/data.json", (route) =>
		route.fulfill({
			json: { ...fixture, checks: { ...fixture.checks, api: failed } },
		}),
	);
	await page.goto("/?period=day");
	await expect(
		page.getByText("Есть сбой, мы уже чиним", { exact: true }),
	).toBeVisible();
	await expect(page.locator('[data-check="api"]')).toContainText("Не работает");
	await expect(
		page.getByRole("heading", { name: "Сейчас есть сбой" }),
	).toBeVisible();
	await expect(page.locator('[data-check="api"]')).toContainText("98,96%");
});
test("phone 360 and 390: no horizontal scroll, touch and keyboard tooltip within viewport", async ({
	page,
}) => {
	await page.route("**/data.json", (route) => route.fulfill({ json: fixture }));
	for (const width of [360, 390]) {
		await page.setViewportSize({ width, height: 844 });
		await page.goto("/?period=day");
		await expect(page.getByText("Все работает", { exact: true })).toBeVisible();
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true);
		const lastSlot = page.locator('[data-check="mrp"] fieldset button').last();
		await lastSlot.click();
		const hint = page.getByRole("tooltip");
		await expect(hint).toBeVisible();
		const box = await hint.boundingBox();
		if (!box) throw new Error("TooltipNotVisible");
		expect(box.x).toBeGreaterThanOrEqual(0);
		expect(box.x + box.width).toBeLessThanOrEqual(width);
		expect(box.y).toBeGreaterThanOrEqual(0);
		expect(box.y + box.height).toBeLessThanOrEqual(844);
		await lastSlot.focus();
		await expect(hint).toBeVisible();
		await lastSlot.press("Escape");
		await expect(hint).toHaveCount(0);
	}
});
