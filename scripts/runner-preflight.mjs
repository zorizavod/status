// Предпроверка сетевой связности раннера GitHub Actions (ZOL-19403).
//
// Зачем: 23.11.2026 раннер GitHub Actions в AWS us-west-2 получил HTTP 000
// (Timeout was reached) по всем 7 проверкам из-за маршрутизации AWS -> РФ,
// хотя прод работал без перебоев. Upptime записал ложный простой на 140 минут.
//
// Логика:
// 1. С раннера проверяем два ключевых адреса (mrp.zolotenkov.ru/api/health и
//    zolotenkov.ru/) через curl.
// 2. Если хотя бы один вернул любой HTTP-код (> 0, в том числе 502/503) —
//    связность у раннера есть, пропускать Upptime НЕЛЬЗЯ (skip_upptime=false).
// 3. Если ОБА адреса дали транспортный отказ (HTTP 000) — делаем контрольный
//    запрос через независимую сеть Globalping (зонды в Европе).
//    - Если хотя бы один зонд Globalping получил HTTP 200 — прод жив,
//      проблема именно в сети этого раннера -> skip_upptime=true.
//    - Если Globalping тоже не видит HTTP 200 или сам недоступен —
//      fail-open: skip_upptime=false, Upptime фиксирует аварию как обычно.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const LOCAL_PROBES = [
  "https://mrp.zolotenkov.ru/api/health",
  "https://zolotenkov.ru/",
];

const GLOBALPING_API = "https://api.globalping.io/v1/measurements";

export function probeLocalHttpCode(url, timeoutSec = 12) {
  try {
    const out = execFileSync(
      "curl",
      ["-sS", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", String(timeoutSec), url],
      { encoding: "utf8", timeout: (timeoutSec + 5) * 1000, stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    const code = Number.parseInt(out, 10);
    return Number.isFinite(code) ? code : 0;
  } catch {
    return 0;
  }
}

export function decidePreflight({ localCodes, globalpingCodes }) {
  const anyLocalHttp = localCodes.some((code) => Number.isFinite(code) && code > 0);
  if (anyLocalHttp) {
    return { skipUpptime: false, reason: "local_http_reachable" };
  }
  const anyExternalOk = globalpingCodes.some((code) => code >= 200 && code < 400);
  if (anyExternalOk) {
    return { skipUpptime: true, reason: "runner_blackout_confirmed_by_globalping" };
  }
  return { skipUpptime: false, reason: "external_probe_did_not_confirm_up" };
}

export async function probeGlobalpingEu(fetchImpl = fetch) {
  try {
    const createResp = await fetchImpl(GLOBALPING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "zolotenkov-status-preflight/1.0",
      },
      body: JSON.stringify({
        type: "http",
        target: "mrp.zolotenkov.ru",
        locations: [{ continent: "EU" }],
        limit: 2,
        measurementOptions: {
          protocol: "HTTPS",
          request: { method: "GET", path: "/api/health" },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!createResp.ok) return [];
    const created = await createResp.json();
    if (!created?.id) return [];

    for (let attempt = 0; attempt < 8; attempt += 1) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollResp = await fetchImpl(`${GLOBALPING_API}/${encodeURIComponent(created.id)}`, {
        headers: { "User-Agent": "zolotenkov-status-preflight/1.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!pollResp.ok) continue;
      const data = await pollResp.json();
      if (data?.status !== "finished") continue;
      const results = Array.isArray(data.results) ? data.results : [];
      return results
        .map((r) => Number(r?.result?.statusCode || 0))
        .filter((n) => Number.isFinite(n));
    }
    return [];
  } catch {
    return [];
  }
}

function writeGithubOutput(skipUpptime, reason) {
  const outPath = process.env.GITHUB_OUTPUT;
  if (!outPath) return;
  appendFileSync(outPath, `skip_upptime=${skipUpptime ? "true" : "false"}\n`);
  appendFileSync(outPath, `reason=${reason}\n`);
}

async function main() {
  const localCodes = LOCAL_PROBES.map((url) => probeLocalHttpCode(url));
  let globalpingCodes = [];
  if (localCodes.every((c) => c === 0)) {
    globalpingCodes = await probeGlobalpingEu();
  }
  const decision = decidePreflight({ localCodes, globalpingCodes });
  writeGithubOutput(decision.skipUpptime, decision.reason);
  console.log(
    JSON.stringify({
      localCodes,
      globalpingCodes,
      skipUpptime: decision.skipUpptime,
      reason: decision.reason,
    })
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((err) => {
    console.error("runner-preflight error:", err?.name || "Error");
    writeGithubOutput(false, "preflight_error_fail_open");
  });
}
