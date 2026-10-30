// End-to-end smoke test against the local dev server (in-memory storage).
//   npm test
import assert from "node:assert/strict";
import { createServer } from "./dev.js";

process.env.ORBIT_API_KEY = "test-key";
const server = createServer().listen(0);
const base = `http://localhost:${server.address().port}`;
const auth = { Authorization: "Bearer test-key", "Content-Type": "application/json" };

async function rpc(method, params, id = 1) {
  const r = await fetch(base + "/mcp", { method: "POST", headers: auth, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  return r.json();
}

try {
  // Auth is enforced
  assert.equal((await fetch(base + "/api/state")).status, 401);

  // Dashboard API
  let r = await fetch(base + "/api/state?month=2026-11", { headers: auth });
  let j = await r.json();
  assert.equal(j.summary.target, 21100);
  assert.equal(j.summary.collected, 0);

  r = await fetch(base + "/api/state", { method: "POST", headers: auth,
    body: JSON.stringify({ action: "log_sale", offer: "web", amount: 2500, client: "Test boutique", date: "2026-11-03", actor: "JR" }) });
  j = await r.json();
  assert.equal(r.status, 200, JSON.stringify(j));
  assert.equal(j.summary.collected, 2500);

  // MCP handshake + tools
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "0" } });
  assert.equal(init.result.serverInfo.name, "revenue-orbit");
  const note = await fetch(base + "/mcp", { method: "POST", headers: auth, body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) });
  assert.equal(note.status, 202);
  const list = await rpc("tools/list", {});
  assert.ok(list.result.tools.find(t => t.name === "log_sale"));

  const sale = await rpc("tools/call", { name: "log_sale", arguments: { offer: "ads", client: "HVAC shop", date: "2026-11-05", actor: "Outreach agent" } });
  assert.ok(!sale.result.isError, JSON.stringify(sale));
  assert.equal(sale.result.structuredContent.logged.amount, 750); // defaults to list price

  const task = await rpc("tools/call", { name: "complete_task", arguments: { task_id: "w1a", month: "2026-11", actor: "JR" } });
  assert.ok(!task.result.isError, JSON.stringify(task));

  const bad = await rpc("tools/call", { name: "log_sale", arguments: { offer: "nope", actor: "x" } });
  assert.equal(bad.result.isError, true);

  const month = await rpc("tools/call", { name: "get_month", arguments: { month: "2026-11" } });
  const m = month.result.structuredContent;
  assert.equal(m.summary.collected, 3250);
  assert.equal(m.summary.tasks_done, 1);

  const act = await rpc("tools/call", { name: "get_activity", arguments: { limit: 10 } });
  assert.equal(act.result.structuredContent.activity.length, 3);

  // Remove a sale through the dashboard API
  const id = m.sales.find(s => s.offer === "web").id;
  r = await fetch(base + "/api/state", { method: "POST", headers: auth, body: JSON.stringify({ action: "remove_sale", month: "2026-11", id, actor: "JR" }) });
  j = await r.json();
  assert.equal(j.summary.collected, 750);

  // Static files
  assert.equal((await fetch(base + "/")).status, 200);
  assert.equal((await fetch(base + "/lib/plan.js")).status, 200);

  console.log("All smoke checks passed.");
} finally {
  server.close();
}
