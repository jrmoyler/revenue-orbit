// End-to-end smoke test against the local dev server (in-memory storage).
//   npm test
import assert from "node:assert/strict";
import { createServer } from "./dev.js";

process.env.ORBIT_API_KEY = "test-key";
process.env.ORBIT_TEAM_KEYS = "mate-key, mate-two";
process.env.ORBIT_BILLS = JSON.stringify({ floor: 1234, personal: 5678 }); // fixture, not real figures
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

  // Bills are owner-only: present for the key holder, absent from every public file
  assert.equal(m.summary.bills_floor, 1234);
  assert.deepEqual(month.result.structuredContent.bills, { floor: 1234, personal: 5678 });
  assert.equal((await fetch(base + "/api/state", { headers: { Authorization: "Bearer wrong" } })).status, 401);
  assert.ok(init.result.instructions.includes("1,234"));

  // Static files
  const html = await (await fetch(base + "/")).text();
  const planSrc = await (await fetch(base + "/lib/plan.js")).text();
  assert.equal((await fetch(base + "/lib/plan.js")).status, 200);
  assert.ok(!/FLOOR|PERSONAL/.test(planSrc), "plan.js is public and must not hold bills");
  assert.ok(!/Bills floor \$|Personal \+ bills<\/div><div class="num"[^>]*>\$/.test(html), "index.html must not hardcode bills");

  // Teammate keys work for shared data but never see bills (REST or MCP)
  const mate = { Authorization: "Bearer mate-two", "Content-Type": "application/json" };
  j = await (await fetch(base + "/api/state?month=2026-11", { headers: mate })).json();
  assert.equal(j.summary.collected, 750);
  assert.equal(j.bills, null);
  assert.equal(j.summary.bills_floor, undefined);
  r = await fetch(base + "/api/state", { method: "POST", headers: mate, body: JSON.stringify({ action: "log_sale", offer: "land", amount: 900, date: "2026-11-06", actor: "Mate" }) });
  j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.bills, null);
  assert.equal(j.summary.bills_floor, undefined);
  const mrpc = async (method, params) => (await fetch(base + "/mcp", { method: "POST", headers: mate, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  assert.ok(!(await mrpc("initialize", { protocolVersion: "2025-06-18" })).result.instructions.includes("1,234"));
  const mm = (await mrpc("tools/call", { name: "get_month", arguments: { month: "2026-11" } })).result.structuredContent;
  assert.equal(mm.bills, undefined);
  assert.equal(mm.summary.bills_floor, undefined);

  // Without ORBIT_BILLS nobody gets bills from the server
  delete process.env.ORBIT_BILLS;
  j = await (await fetch(base + "/api/state?month=2026-11", { headers: auth })).json();
  assert.equal(j.bills, null);
  assert.equal(j.summary.bills_floor, undefined);

  console.log("All smoke checks passed.");
} finally {
  server.close();
}
