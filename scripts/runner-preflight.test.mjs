import test from "node:test";
import assert from "node:assert/strict";
import { decidePreflight } from "./runner-preflight.mjs";

test("любой HTTP-ответ с раннера (включая 502) НЕ пропускает Upptime", () => {
  assert.deepEqual(
    decidePreflight({ localCodes: [200, 200], globalpingCodes: [] }),
    { skipUpptime: false, reason: "local_http_reachable" }
  );
  assert.deepEqual(
    decidePreflight({ localCodes: [502, 0], globalpingCodes: [200, 200] }),
    { skipUpptime: false, reason: "local_http_reachable" }
  );
});

test("полный транспортный таймаут раннера (0, 0) при живом Globalping (200) пропускает Upptime", () => {
  assert.deepEqual(
    decidePreflight({ localCodes: [0, 0], globalpingCodes: [200, 200] }),
    { skipUpptime: true, reason: "runner_blackout_confirmed_by_globalping" }
  );
  assert.deepEqual(
    decidePreflight({ localCodes: [0, 0], globalpingCodes: [0, 200] }),
    { skipUpptime: true, reason: "runner_blackout_confirmed_by_globalping" }
  );
});

test("полный таймаут и у раннера, и у Globalping НЕ пропускает Upptime (реальная авария)", () => {
  assert.deepEqual(
    decidePreflight({ localCodes: [0, 0], globalpingCodes: [0, 502] }),
    { skipUpptime: false, reason: "external_probe_did_not_confirm_up" }
  );
  assert.deepEqual(
    decidePreflight({ localCodes: [0, 0], globalpingCodes: [] }),
    { skipUpptime: false, reason: "external_probe_did_not_confirm_up" }
  );
});
