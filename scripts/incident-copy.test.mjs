// Проверки текстов аварий. Запуск: node --test scripts/
import test from "node:test";
import assert from "node:assert/strict";

import {
  detectKind,
  detectSlug,
  formatDuration,
  formatMoscowTime,
  hasMarker,
  incidentBody,
  incidentTitle,
  interimComment,
  isOpeningComment,
  isResolvedComment,
  KIND_LABELS,
  resolvedComment,
} from "./incident-copy.mjs";

const started = new Date("2026-08-23T11:35:00Z"); // 14:35 МСК
const recovered = new Date("2026-08-23T12:12:00Z"); // 15:12 МСК, 37 минут

test("время по Москве: полная форма и короткая в тот же день", () => {
  assert.equal(formatMoscowTime(started), "23 августа, 14:35 (МСК)");
  assert.equal(formatMoscowTime(recovered, started), "15:12 (МСК)");
  assert.equal(
    formatMoscowTime(new Date("2026-08-24T05:00:00Z"), started),
    "24 августа, 08:00 (МСК)"
  );
});

test("длительность: минуты, часы, часы с минутами, сутки", () => {
  assert.equal(formatDuration(started, recovered), "37 минут");
  assert.equal(formatDuration(started, new Date("2026-08-23T12:36:00Z")), "1 час 1 минута");
  assert.equal(formatDuration(started, new Date("2026-08-23T12:55:00Z")), "1 час 20 минут");
  assert.equal(formatDuration(started, new Date("2026-08-23T15:35:00Z")), "4 часа");
  assert.equal(formatDuration(started, new Date("2026-08-23T23:35:00Z")), "12 часов");
  assert.equal(formatDuration(started, new Date("2026-08-25T11:35:00Z")), "2 дня");
  assert.equal(formatDuration(started, new Date("2026-08-25T14:35:00Z")), "2 дня 3 часа");
  assert.equal(formatDuration(started, new Date("2026-08-23T11:35:20Z")), "меньше минуты");
});

test("заголовки берут формулировку по slug, а не имя проверки", () => {
  assert.equal(incidentTitle("down", "api"), "Не работает: рабочее место MRP открывается, но не показывает и не сохраняет данные");
  assert.equal(incidentTitle("degraded", "docs"), "Работает медленно: справка `support.zolotenkov.ru` открывается дольше обычного");
});

test("тело записи начинается со времени и содержит маркер", () => {
  const body = incidentBody("down", "mrp", started);
  assert.match(body, /^С 23 августа, 14:35 \(МСК\) рабочее место MRP не открывается\./);
  assert.ok(hasMarker(body));
  assert.match(body, /svetlana@zolotenkov\.ru/);
});

// Пункт приёмки 1 задачи ZOL-11734: разновидность аварии определяется меткой и
// маркером, а не подстрокой `degraded` в заголовке — заголовок у нас русский.
test("восстановление после замедления не превращается в «снова работает»", () => {
  const russianTitle = incidentTitle("degraded", "api");
  assert.ok(!russianTitle.includes("degraded"));
  const kind = detectKind({ labels: ["status", "api", KIND_LABELS.degraded], title: russianTitle });
  assert.equal(kind, "degraded");
  const text = resolvedComment(kind, "api", started, recovered);
  assert.match(text, /^Работает с обычной скоростью\./);
  assert.match(text, /Замедление длилось 37 минут\./);
  assert.match(text, /15:12 \(МСК\)/);
});

test("восстановление после падения", () => {
  const kind = detectKind({ labels: ["status", "mrp", KIND_LABELS.down], title: incidentTitle("down", "mrp") });
  assert.equal(kind, "down");
  const text = resolvedComment(kind, "mrp", started, recovered);
  assert.match(text, /^Работает\. С 15:12 \(МСК\) рабочее место MRP снова открывается\. Сбой длился 37 минут\./);
  assert.match(text, /Это последнее сообщение по этой аварии\./);
});

test("разновидность восстанавливается из тела, если метки ещё нет", () => {
  const body = incidentBody("degraded", "website", started);
  assert.equal(detectKind({ labels: ["status", "website"], body, title: "неважно" }), "degraded");
});

test("разновидность берётся из английского заголовка Upptime до переписывания", () => {
  assert.equal(
    detectKind({ labels: ["status", "mrp"], title: "⚠️ Рабочее место MRP has degraded performance" }),
    "degraded"
  );
  assert.equal(detectKind({ labels: ["status", "mrp"], title: "🛑 Рабочее место MRP is down" }), "down");
});

test("slug вычисляется из меток, служебные метки пропускаются", () => {
  assert.equal(detectSlug(["status", KIND_LABELS.down, "database"]), "database");
});

test("сообщение Upptime о восстановлении узнаётся", () => {
  assert.ok(isResolvedComment("**Resolved:** Сайт is back up in [`abc1234`]"));
  assert.ok(!isResolvedComment("Всё ещё чиним."));
});

test("промежуточное сообщение", () => {
  const text = interimComment("down", "database", started);
  assert.match(text, /^Всё ещё чиним\. С 23 августа, 14:35 \(МСК\) рабочее место MRP не сохраняет и не показывает данные; работаем над восстановлением\./);
});

// Красные линии из постановки: ничего внутреннего на публичной странице.
test("в текстах нет внутренних имён, кодов и слова «инцидент»", () => {
  const texts = [];
  for (const slug of ["mrp", "api", "database", "website", "docs"]) {
    for (const kind of ["down", "degraded"]) {
      texts.push(incidentTitle(kind, slug), incidentBody(kind, slug, started));
      texts.push(interimComment(kind, slug, started), resolvedComment(kind, slug, started, recovered));
    }
  }
  for (const text of texts) {
    const visible = text.replace(/<!--[\s\S]*?-->/g, "");
    for (const forbidden of [
      "инцидент",
      "деградац",
      "даунтайм",
      "HTTP",
      "commit",
      "github.com",
      "/api/health",
      "Dokploy",
      "degraded",
    ]) {
      assert.ok(
        !visible.toLowerCase().includes(forbidden.toLowerCase()),
        `в тексте нашлось «${forbidden}»: ${visible.slice(0, 80)}`
      );
    }
  }
});

test("первое сообщение помечается маркером opening и узнаётся", () => {
  const body = incidentBody("down", "mrp", started, "opening");
  assert.ok(isOpeningComment(body));
  assert.ok(!isOpeningComment(incidentBody("down", "mrp", started)));
  // Разновидность аварии из такого маркера читать нельзя — она берётся из тела
  // записи и из метки.
  assert.equal(detectKind({ labels: ["status", "mrp", KIND_LABELS.down], body, title: "" }), "down");
});
