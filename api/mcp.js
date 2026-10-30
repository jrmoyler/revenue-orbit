// MCP server (Streamable HTTP, stateless, JSON responses) at /api/mcp (also /mcp).
// Connect Claude, other LLMs or agents with:
//   URL:    https://<your-deployment>/mcp
//   Header: Authorization: Bearer <ORBIT_API_KEY>
import { authorize, readJson, send } from "../lib/http.js";
import { getMonth, getActivity, getBills, logSale, removeSale, setTask, logActivity, currentMonth, OrbitError } from "../lib/orbit.js";
import { OFFERS, WEEKS, TARGET } from "../lib/plan.js";

const SUPPORTED = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER = { name: "revenue-orbit", version: "1.0.0" };
const instructions = () => `Revenue Orbit tracks Hataalii's (JR's) monthly revenue target of $${TARGET.toLocaleString("en-US")}${getBills() ? ` (bills floor $${getBills().floor.toLocaleString("en-US")})` : ""} across nine service offers and a four-week playbook.
- Call get_month first to see progress, pace and which playbook tasks are open.
- Log every collected payment with log_sale (amount defaults to the offer price). Only log money actually received, not proposals.
- Mark playbook work with complete_task. Record other meaningful progress (calls booked, proposals sent) with log_activity.
- Always pass actor with your own name or the teammate you are acting for, so the dashboard shows who did what.
- If the Collective Vault connector is also available to you, mirror each write there with a one-line entry, unless the server already forwards events (check get_month → vault_bridge).`;

const monthProp = { type: "string", description: "Month as YYYY-MM. Defaults to the current month (America/New_York)." };
const actorProp = { type: "string", description: "Who did the work: your agent name or the teammate's name." };

const TOOLS = [
  { name: "get_month",
    description: "Progress for one month: collected vs $21,100 target, pace, needed per day, per-offer progress, playbook tasks with done state, and the logged sales.",
    inputSchema: { type: "object", properties: { month: monthProp }, additionalProperties: false },
    annotations: { readOnlyHint: true } },
  { name: "list_offers",
    description: "The nine offers with id, price, planned monthly quantity, pitch, proof and target buyer. Use the id when logging a sale.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true } },
  { name: "log_sale",
    description: "Record a payment actually collected for one offer. Lights up that offer's planet on the dashboard.",
    inputSchema: { type: "object", required: ["offer", "actor"], additionalProperties: false, properties: {
      offer: { type: "string", enum: OFFERS.map(o => o.id), description: "Offer id (see list_offers)." },
      amount: { type: "number", description: "Whole dollars collected. Defaults to the offer's list price." },
      client: { type: "string", description: "Client or short note, e.g. 'Short North barbershop'." },
      date: { type: "string", description: "Payment date YYYY-MM-DD. Defaults to today; its month decides where the sale counts." },
      note: { type: "string", description: "Optional detail, e.g. 'deposit 50%'." },
      actor: actorProp } } },
  { name: "remove_sale",
    description: "Delete a mistaken sale entry by id (ids come from get_month).",
    inputSchema: { type: "object", required: ["id", "actor"], additionalProperties: false, properties: {
      id: { type: "string" }, month: monthProp, actor: actorProp } },
    annotations: { destructiveHint: true } },
  { name: "complete_task",
    description: "Mark a playbook task done (or reopen it with done=false). Task ids look like w1a, w2c.",
    inputSchema: { type: "object", required: ["task_id", "actor"], additionalProperties: false, properties: {
      task_id: { type: "string", enum: WEEKS.flatMap(w => w.tasks.map(t => t[0])) },
      done: { type: "boolean", description: "Defaults to true." },
      note: { type: "string", description: "Optional proof or detail, e.g. a link." },
      month: monthProp, actor: actorProp } } },
  { name: "log_activity",
    description: "Add a progress note to the team activity feed (calls booked, proposals sent, content posted). Does not change revenue.",
    inputSchema: { type: "object", required: ["summary", "actor"], additionalProperties: false, properties: {
      summary: { type: "string", description: "One line, e.g. 'Booked discovery call with a Clintonville bakery'." },
      month: monthProp, actor: actorProp } } },
  { name: "get_activity",
    description: "Most recent team and agent activity across all months, newest first.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "1–200, default 30." } }, additionalProperties: false },
    annotations: { readOnlyHint: true } },
];

function monthView(s) {
  const tasks = WEEKS.map(w => ({ week: w.n, days: `${w.days[0]}-${Math.min(w.days[1], s.summary.days_in_month)}`, title: w.title,
    tasks: w.tasks.map(t => ({ id: t[0], text: t[1], tag: t[2], done: Boolean(s.done[t[0]]), by: s.done[t[0]]?.by })) }));
  return { month: s.month, summary: s.summary, ...(s.bills && { bills: s.bills }), playbook: tasks, sales: s.logs,
    storage: s.persistent ? "redis" : "memory (not persistent — connect Upstash Redis)", vault_bridge: Boolean(process.env.VAULT_MCP_URL) };
}

async function callTool(name, a = {}) {
  switch (name) {
    case "get_month": return monthView(await getMonth(a.month));
    case "list_offers": return { target: TARGET, offers: OFFERS.map(({ color, ...o }) => ({ ...o, plan: o.price * o.qty })) };
    case "log_sale": { const r = await logSale({ ...a, source: "mcp" }); return { logged: r.entry, summary: r.summary }; }
    case "remove_sale": { const r = await removeSale({ month: a.month || currentMonth(), id: a.id, actor: a.actor, source: "mcp" }); return { removed: a.id, summary: r.summary }; }
    case "complete_task": { const r = await setTask({ ...a, done: a.done !== false, source: "mcp" }); return { task_id: a.task_id, done: a.done !== false, tasks_done: r.summary.tasks_done, tasks_total: r.summary.tasks_total }; }
    case "log_activity": return { logged: await logActivity({ ...a, source: "mcp" }) };
    case "get_activity": return { activity: await getActivity(a.limit) };
    default: throw new OrbitError(`Unknown tool: ${name}`);
  }
}

async function handle(msg) {
  const { id, method, params = {} } = msg || {};
  const isNote = id === undefined || id === null;
  const ok = result => ({ jsonrpc: "2.0", id, result });
  const err = (code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== "2.0" || typeof method !== "string") return err(-32600, "Invalid request");
  if (isNote) return null; // notifications (e.g. notifications/initialized) need no reply

  switch (method) {
    case "initialize": {
      const v = SUPPORTED.includes(params.protocolVersion) ? params.protocolVersion : SUPPORTED[0];
      return ok({ protocolVersion: v, capabilities: { tools: { listChanged: false } }, serverInfo: SERVER, instructions: instructions() });
    }
    case "ping": return ok({});
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call": {
      try {
        const out = await callTool(params.name, params.arguments || {});
        return ok({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }], structuredContent: out });
      } catch (e) {
        const message = e instanceof OrbitError ? e.message : "Server error: " + (e.message || "unknown");
        if (!(e instanceof OrbitError)) console.error(e);
        return ok({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    case "resources/list": return ok({ resources: [] });
    case "prompts/list": return ok({ prompts: [] });
    default: return err(-32601, `Method not found: ${method}`);
  }
}

export default async function handler(req, res) {
  if (req.method === "GET" || req.method === "DELETE") return send(res, 405, { error: "This MCP server is stateless; POST JSON-RPC messages." }, { Allow: "POST" });
  if (req.method !== "POST") return send(res, 405, { error: "Use POST." }, { Allow: "POST" });
  const auth = authorize(req);
  if (!auth.ok) return send(res, auth.status, { jsonrpc: "2.0", id: null, error: { code: -32001, message: auth.error } },
    auth.status === 401 ? { "WWW-Authenticate": 'Bearer realm="revenue-orbit"' } : {});
  const body = await readJson(req);
  if (body === null) return send(res, 400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(handle))).filter(Boolean);
    return out.length ? send(res, 200, out) : send(res, 202);
  }
  const out = await handle(body);
  return out ? send(res, 200, out) : send(res, 202);
}
