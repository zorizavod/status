// Тонкая обёртка над API GitHub. Зависимостей нет намеренно: рабочий узел
// Actions запускает эти скрипты голым node, без `npm install`.

const token = process.env.GITHUB_TOKEN;
const repository = process.env.GITHUB_REPOSITORY;

if (!token) throw new Error("GITHUB_TOKEN не задан");
if (!repository) throw new Error("GITHUB_REPOSITORY не задан");

export const [owner, repo] = repository.split("/");

export async function api(method, path, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "content-type": "application/json",
      "user-agent": "zolotenkov-status-copy",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    // Тело ответа не печатаем целиком: в него попадают заголовки запроса.
    throw new Error(`${method} ${path.split("?")[0]} → HTTP ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

/** Запись закрыта для комментариев (`issues.lock`) — снимаем замок на время правки. */
export async function withUnlocked(issueNumber, action) {
  try {
    await api("DELETE", `/repos/${owner}/${repo}/issues/${issueNumber}/lock`);
  } catch (error) {
    if (!/HTTP 404/.test(String(error?.message))) throw error;
  }
  try {
    return await action();
  } finally {
    await api("PUT", `/repos/${owner}/${repo}/issues/${issueNumber}/lock`, {});
  }
}
