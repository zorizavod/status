// Приводит записи об авариях к согласованному тексту для покупателя (ZOL-11734).
//
// Зачем отдельный шаг. Заголовок и тело записи зашиты в код действия
// upptime/uptime-monitor (`src/update.ts`), ключами `i18n` они не настраиваются:
// по умолчанию покупатель увидел бы «🛑 Серверная часть is down» с внутренним
// адресом проверки, кодом ответа и ссылкой на коммит.
//
// Почему по событию `workflow_run`, а не по `issues`. Записи заводит сам
// Upptime токеном `GITHUB_TOKEN`, а события от этого токена намеренно не
// запускают другие рабочие процессы. Поэтому мы дожидаемся окончания прогона
// «Uptime CI» и проходим по записям сами. Проход идемпотентный: уже
// переписанное узнаётся по маркеру и второй раз не трогается.

import {
  detectKind,
  detectSlug,
  hasMarker,
  incidentBody,
  incidentTitle,
  isKnownSlug,
  isResolvedComment,
  KIND_LABELS,
  resolvedComment,
} from "./incident-copy.mjs";
import { api, owner, repo, withUnlocked } from "./github.mjs";

const RECENT_DAYS = 3;

const issues = await api(
  "GET",
  `/repos/${owner}/${repo}/issues?labels=status&state=all&sort=updated&direction=desc&per_page=50`
);

let changed = 0;
const warnings = [];

for (const issue of issues) {
  if (issue.pull_request) continue;
  const closedAt = issue.closed_at ? new Date(issue.closed_at) : null;
  if (closedAt && Date.now() - closedAt.getTime() > RECENT_DAYS * 86400000) continue;

  const labels = issue.labels.map((l) => (typeof l === "string" ? l : l.name));
  const slug = detectSlug(labels);
  const kind = detectKind({ labels, body: issue.body, title: issue.title });
  const startedAt = new Date(issue.created_at);

  if (!isKnownSlug(slug)) {
    warnings.push(
      `Запись #${issue.number}: проверка «${slug || "без метки"}» не описана в таблице ` +
        "scripts/incident-copy.mjs — покупатель видит общую формулировку."
    );
  }

  const kindLabel = KIND_LABELS[kind];
  const needsLabel = !labels.includes(kindLabel);
  const needsRewrite = !hasMarker(issue.body);

  const comments = await api(
    "GET",
    `/repos/${owner}/${repo}/issues/${issue.number}/comments?per_page=100`
  );
  const staleResolved = comments.filter((c) => isResolvedComment(c.body) && !hasMarker(c.body));

  if (!needsLabel && !needsRewrite && staleResolved.length === 0) continue;

  if (needsLabel) {
    // Чем была авария, помним меткой: заголовок мы переписываем по-русски, и
    // подстрока `degraded` из него исчезает.
    await api("POST", `/repos/${owner}/${repo}/issues/${issue.number}/labels`, {
      labels: [kindLabel],
    });
    console.log(`#${issue.number}: поставлена метка ${kindLabel}`);
  }

  await withUnlocked(issue.number, async () => {
    if (needsRewrite) {
      await api("PATCH", `/repos/${owner}/${repo}/issues/${issue.number}`, {
        title: incidentTitle(kind, slug),
        body: incidentBody(kind, slug, startedAt),
      });
      console.log(`#${issue.number}: переписаны заголовок и тело (${kind}/${slug || "?"})`);
      changed++;
    }
    for (const comment of staleResolved) {
      await api("PATCH", `/repos/${owner}/${repo}/issues/comments/${comment.id}`, {
        body: resolvedComment(kind, slug, startedAt, new Date(comment.created_at)),
      });
      console.log(`#${issue.number}: переписано сообщение о восстановлении (${kind})`);
      changed++;
    }
  });
}

console.log(`Готово, правок: ${changed}`);

if (warnings.length) {
  for (const warning of warnings) console.log(`ВНИМАНИЕ: ${warning}`);
  process.exit(1);
}
