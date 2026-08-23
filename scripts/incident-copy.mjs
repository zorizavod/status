// Тексты сообщений об авариях для публичной страницы https://status.zolotenkov.ru/
//
// Источник формулировок, единственный: docs/ops/status-page-incident-copy-zol-11731.md
// в репозитории zolotenkov (задача ZOL-11731, внедрение — ZOL-11734). Меняешь
// формулировку — сначала правишь тот документ, потом этот файл.
//
// Красные линии: в тексте на публичной странице нет внутренних имён и адресов
// проверок, кодов ответа, кусков логов, ссылок на коммиты и панели, слова
// «инцидент».

export const MARKER_PREFIX = "<!-- zol-status-copy v1";

// §3 документа. Подстановка берётся по slug проверки, а не по её имени.
const SERVICE_PHRASES = {
  mrp: {
    down: "рабочее место MRP не открывается",
    degraded: "рабочее место MRP открывается дольше обычного",
    again: "рабочее место MRP снова открывается",
  },
  api: {
    down: "рабочее место MRP открывается, но не показывает и не сохраняет данные",
    degraded:
      "рабочее место MRP отвечает с задержкой: списки и сохранение ждут дольше обычного",
    again: "рабочее место MRP снова показывает и сохраняет данные",
  },
  database: {
    down: "рабочее место MRP не сохраняет и не показывает данные",
    degraded: "сохранение и списки в рабочем месте MRP отвечают дольше обычного",
    again: "рабочее место MRP снова сохраняет и показывает данные",
  },
  website: {
    down: "сайт `zolotenkov.ru` не открывается",
    degraded: "сайт `zolotenkov.ru` открывается дольше обычного",
    again: "сайт `zolotenkov.ru` снова открывается",
  },
  docs: {
    down: "справка `support.zolotenkov.ru` не открывается",
    degraded: "справка `support.zolotenkov.ru` открывается дольше обычного",
    again: "справка `support.zolotenkov.ru` снова открывается",
  },
};

// Проверка добавлена в .upptimerc.yml, а строку в таблицу выше дописать забыли.
// Покупатель всё равно читает по-русски, а прогон падает — чтобы мы заметили.
const FALLBACK_PHRASES = {
  down: "сервис временно недоступен",
  degraded: "сервис отвечает дольше обычного",
  again: "сервис снова доступен",
};

export function servicePhrase(slug, kind) {
  const row = SERVICE_PHRASES[slug];
  return (row || FALLBACK_PHRASES)[kind === "again" ? "again" : kind];
}

export function isKnownSlug(slug) {
  return Object.prototype.hasOwnProperty.call(SERVICE_PHRASES, slug);
}

const MOSCOW = "Europe/Moscow";

function moscowParts(date) {
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return parts;
}

function moscowDayKey(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MOSCOW,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * §8 документа: `23 августа, 14:35 (МСК)`; если событие в тот же день, что и
 * начало аварии, — короче: `14:35 (МСК)`. Часовой пояс подписывается всегда,
 * секунды не показываем.
 */
export function formatMoscowTime(date, sameDayAs) {
  const p = moscowParts(date);
  const time = `${p.hour}:${p.minute} (МСК)`;
  if (sameDayAs && moscowDayKey(date) === moscowDayKey(sameDayAs)) return time;
  return `${p.day} ${p.month}, ${time}`;
}

function plural(n, one, few, many) {
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** §8 документа: `37 минут`, `1 час 20 минут`, `4 часа`. */
export function formatDuration(fromDate, toDate) {
  const totalMinutes = Math.round((toDate.getTime() - fromDate.getTime()) / 60000);
  if (totalMinutes < 1) return "меньше минуты";
  const minutesWord = (n) => `${n} ${plural(n, "минута", "минуты", "минут")}`;
  const hoursWord = (n) => `${n} ${plural(n, "час", "часа", "часов")}`;
  const daysWord = (n) => `${n} ${plural(n, "день", "дня", "дней")}`;
  if (totalMinutes < 60) return minutesWord(totalMinutes);
  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes ? `${hoursWord(totalHours)} ${minutesWord(minutes)}` : hoursWord(totalHours);
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours ? `${daysWord(days)} ${hoursWord(hours)}` : daysWord(days);
}

export function marker(kind, slug) {
  return `${MARKER_PREFIX} kind=${kind}${slug ? ` slug=${slug}` : ""} -->`;
}

export function hasMarker(text) {
  return typeof text === "string" && text.includes(MARKER_PREFIX);
}

/** §4 и §5 документа. */
export function incidentTitle(kind, slug) {
  const head = kind === "degraded" ? "Работает медленно" : "Не работает";
  return `${head}: ${servicePhrase(slug, kind)}`;
}

/** §4 и §5 документа. */
export function incidentBody(kind, slug, startedAt, markerKind) {
  const time = formatMoscowTime(startedAt);
  const service = servicePhrase(slug, kind);
  const text =
    kind === "degraded"
      ? [
          `С ${time} ${service}.`,
          "Мы уже знаем о замедлении: это сообщение появилось автоматически, как только внешняя проверка увидела время ответа выше нашего порога. Разбираемся с причиной.",
          "Данные при этом не теряются: если страница долго думает, дождитесь ответа и не отправляйте форму повторно.",
          "Следующее сообщение появится здесь же, когда скорость вернётся к обычной, — обычно в течение часа. Если работать невозможно, напишите на svetlana@zolotenkov.ru.",
        ]
      : [
          `С ${time} ${service}.`,
          "Мы уже знаем о сбое: это сообщение появилось автоматически, как только внешняя проверка перестала получать ответ. Занимаемся восстановлением.",
          "Следующее сообщение появится здесь же, на этой странице, когда сервис заработает, — обычно в течение часа после восстановления, потому что проверка идёт снаружи и несколько раз в час. Обновлять страницу вручную не нужно, автоматических уведомлений мы не рассылаем — следите за этой страницей.",
          "Если работа стоит и это срочно, напишите на svetlana@zolotenkov.ru — ответим и подскажем, чем заменить сервис на время сбоя.",
        ];
  return `${text.join("\n\n")}\n\n${marker(markerKind || kind, slug)}`;
}

/** §6 документа: промежуточное сообщение, раз в час при сбое дольше часа. */
export function interimComment(kind, slug, startedAt) {
  const time = formatMoscowTime(startedAt);
  const service = servicePhrase(slug, kind);
  return (
    `Всё ещё чиним. С ${time} ${service}; работаем над восстановлением. ` +
    "Следующее сообщение — не позже чем через час, даже если чинить будем дольше." +
    `\n\n${marker("interim", slug)}`
  );
}

/**
 * §7 документа. Разновидность выбирается по тому, чем была авария, а НЕ по
 * подстроке `degraded` в заголовке: заголовок у нас по-русски. Пункт приёмки 1
 * задачи ZOL-11734.
 */
export function resolvedComment(kind, slug, startedAt, resolvedAt) {
  const time = formatMoscowTime(resolvedAt, startedAt);
  const service = servicePhrase(slug, "again");
  const duration = formatDuration(startedAt, resolvedAt);
  const text =
    kind === "degraded"
      ? [
          `Работает с обычной скоростью. С ${time} ${service}, время ответа вернулось к норме. Замедление длилось ${duration}.`,
          "Если у вас по-прежнему медленно, напишите на svetlana@zolotenkov.ru — посмотрим отдельно, дело может быть в вашей сети.",
          "Это последнее сообщение по этому замедлению.",
        ]
      : [
          `Работает. С ${time} ${service}. Сбой длился ${duration}.`,
          "Если у вас всё ещё не открывается, обновите страницу браузера: он мог запомнить ответ, полученный во время сбоя. Не помогло — напишите на svetlana@zolotenkov.ru.",
          "Это последнее сообщение по этой аварии. Причину мы разбираем отдельно.",
        ];
  return `${text.join("\n\n")}\n\n${marker("resolved", slug)}`;
}

export const KIND_LABELS = { down: "zol-status:down", degraded: "zol-status:degraded" };

/**
 * Чем была авария. Порядок важен: метка и маркер в теле переживают
 * переписывание заголовка по-русски, английский заголовок — нет.
 */
export function detectKind({ labels = [], body = "", title = "" }) {
  if (labels.includes(KIND_LABELS.degraded)) return "degraded";
  if (labels.includes(KIND_LABELS.down)) return "down";
  const fromBody = /zol-status-copy v1 kind=(down|degraded)/.exec(body || "");
  if (fromBody) return fromBody[1];
  if ((title || "").includes("degraded") || (title || "").startsWith("Работает медленно:"))
    return "degraded";
  return "down";
}

const SLUG_SKIP = new Set(["status", "maintenance", KIND_LABELS.down, KIND_LABELS.degraded]);

export function detectSlug(labels = []) {
  return labels.find((l) => !SLUG_SKIP.has(l)) || "";
}

/** Первое сообщение, которое мы дублируем комментарием: тело страница не выводит. */
export function isOpeningComment(body = "") {
  return (body || "").includes(`${MARKER_PREFIX} kind=opening`);
}

/** Комментарий, который Upptime пишет при восстановлении. */
export function isResolvedComment(body = "") {
  return body.trimStart().startsWith("**Resolved:**");
}
