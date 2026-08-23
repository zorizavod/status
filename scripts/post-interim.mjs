// Промежуточное сообщение «Всё ещё чиним» (§6 документа с текстами).
//
// Правило ГенДира: при сбое дольше часа Дежурный пишет это сообщение и
// повторяет его раз в час до восстановления. Запись закрыта для комментариев,
// поэтому дописываем со снятием замка — ради этого шага он и снимается.
//
// Запуск: рабочий процесс «Промежуточное сообщение об аварии» (кнопка Run
// workflow) либо `GITHUB_TOKEN=… GITHUB_REPOSITORY=zorizavod/status node
// scripts/post-interim.mjs <номер записи>`.

import { detectKind, detectSlug, interimComment } from "./incident-copy.mjs";
import { api, owner, repo, withUnlocked } from "./github.mjs";

const issueNumber = Number(process.argv[2] || process.env.ISSUE_NUMBER);
if (!Number.isInteger(issueNumber) || issueNumber <= 0)
  throw new Error("Нужен номер записи об аварии");

const issue = await api("GET", `/repos/${owner}/${repo}/issues/${issueNumber}`);
if (issue.state !== "open")
  throw new Error(`Запись #${issueNumber} уже закрыта — промежуточное сообщение не нужно`);

const labels = issue.labels.map((l) => (typeof l === "string" ? l : l.name));
const kind = detectKind({ labels, body: issue.body, title: issue.title });
const slug = detectSlug(labels);

await withUnlocked(issueNumber, () =>
  api("POST", `/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    body: interimComment(kind, slug, new Date(issue.created_at)),
  })
);

console.log(`#${issueNumber}: промежуточное сообщение опубликовано (${kind}/${slug || "?"})`);
