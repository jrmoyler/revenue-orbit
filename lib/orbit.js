// Core operations shared by the REST API (dashboard) and the MCP server (agents).
import { TARGET, OFFERS, WEEKS, ALL_TASKS, TIMEZONE } from "./plan.js";
import { hset, hdel, hgetall, lpushCapped, lrange, persistent } from "./store.js";
import { forwardToVault } from "./vault.js";

const K = {
  logs: m => `orbit:logs:${m}`,
  done: m => `orbit:done:${m}`,
  activity: "orbit:activity",
};

// Owner-only monthly bills, e.g. ORBIT_BILLS={"floor":1234,"personal":5678}.
// Kept in an env var, never in a file the dashboard downloads. Only the authorized
// API/MCP responses include them; unset or invalid means nobody gets bills from the server.
export function getBills() {
  const raw = process.env.ORBIT_BILLS;
  if (!raw) return null;
  try {
    const b = JSON.parse(raw);
    if (Number.isFinite(b.floor) && b.floor > 0 && Number.isFinite(b.personal) && b.personal > 0) return { floor: b.floor, personal: b.personal };
  } catch {}
  console.error('ORBIT_BILLS must look like {"floor":1234,"personal":5678}; ignoring it.');
  return null;
}

export class OrbitError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// Today's date in the business time zone, as {y, m, d}.
export function todayParts() {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date()).reduce((a, x) => (a[x.type] = x.value, a), {});
  return { y: +p.year, m: +p.month, d: +p.day };
}
export function currentMonth() {
  const t = todayParts();
  return `${t.y}-${String(t.m).padStart(2, "0")}`;
}
export function normMonth(month) {
  if (month == null || month === "") return currentMonth();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(month))) throw new OrbitError("month must look like YYYY-MM, e.g. 2026-11");
  return String(month);
}
function normDate(date, month) {
  if (!date) {
    const t = todayParts();
    const cur = `${t.y}-${String(t.m).padStart(2, "0")}`;
    return cur === month ? `${cur}-${String(t.d).padStart(2, "0")}` : `${month}-01`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) throw new OrbitError("date must look like YYYY-MM-DD");
  return String(date);
}
const clean = (s, n = 120) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

function findOffer(offer) {
  const q = String(offer || "").toLowerCase().trim();
  const o = OFFERS.find(x => x.id === q || x.short.toLowerCase() === q || x.name.toLowerCase() === q);
  if (!o) throw new OrbitError(`Unknown offer "${offer}". Use one of: ${OFFERS.map(x => x.id).join(", ")}`);
  return o;
}
function findTask(id) {
  for (const w of WEEKS) for (const t of w.tasks) if (t[0] === id) return { id: t[0], text: t[1], tag: t[2], week: w.n };
  throw new OrbitError(`Unknown task "${id}". Use one of: ${ALL_TASKS.join(", ")}`);
}

async function record(evt) {
  const e = { at: new Date().toISOString(), ...evt };
  await lpushCapped(K.activity, JSON.stringify(e));
  // Best effort: never fail the write because the Vault is unreachable.
  forwardToVault(e).catch(() => {});
  return e;
}

// Reads --------------------------------------------------------------------
export async function getMonth(monthIn) {
  const month = normMonth(monthIn);
  const [rawLogs, rawDone] = await Promise.all([hgetall(K.logs(month)), hgetall(K.done(month))]);
  const logs = Object.values(rawLogs).map(v => { try { return JSON.parse(v); } catch { return null; } })
    .filter(Boolean).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const done = {};
  for (const [k, v] of Object.entries(rawDone)) { try { done[k] = JSON.parse(v); } catch { done[k] = { done: true }; } }
  const bills = getBills();
  return { month, logs, done, summary: summarize(month, logs, done, bills), bills, persistent };
}

export function summarize(month, logs, done, bills = null) {
  const [y, m] = month.split("-").map(Number);
  const dim = new Date(y, m, 0).getDate();
  const t = todayParts();
  const cmp = (y * 12 + m) - (t.y * 12 + t.m);
  const state = cmp > 0 ? "future" : cmp < 0 ? "past" : "now";
  const day = state === "now" ? t.d : state === "past" ? dim : 0;
  const daysLeft = state === "now" ? dim - t.d + 1 : state === "future" ? dim : 0;
  const frac = state === "now" ? (t.d - 0.5) / dim : state === "past" ? 1 : 0;

  const collected = logs.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const remaining = Math.max(0, TARGET - collected);
  const expected = Math.round(TARGET * frac);
  const byOffer = OFFERS.map(o => {
    const mine = logs.filter(l => l.offer === o.id);
    const sum = mine.reduce((s, l) => s + (Number(l.amount) || 0), 0);
    return { id: o.id, name: o.name, plan: o.price * o.qty, planned_sales: o.qty, price: o.price,
      collected: sum, sales: mine.length, pct: Math.round(Math.min(1, sum / (o.price * o.qty)) * 100) };
  });
  const tasksDone = ALL_TASKS.filter(k => done[k]).length;
  const week = WEEKS.find(w => Math.max(1, day) >= w.days[0] && Math.max(1, day) <= w.days[1]) || WEEKS[0];
  return {
    target: TARGET, collected, remaining, pct: Math.round(Math.min(1, collected / TARGET) * 1000) / 10,
    month_state: state, days_in_month: dim, days_left: daysLeft,
    needed_per_day: daysLeft ? Math.round(remaining / daysLeft) : 0,
    expected_by_today: expected,
    pace: collected >= TARGET ? "target_hit" : state === "future" ? "not_started" : collected >= expected ? "on_pace" : "behind",
    behind_by: Math.max(0, expected - collected),
    ...(bills && { bills_floor: bills.floor, bills_covered: collected >= bills.floor,
      personal_share_filled: Math.min(bills.personal, collected), profit_share_filled: Math.max(0, Math.min(TARGET - bills.personal, collected - bills.personal)) }),
    by_offer: byOffer,
    tasks_done: tasksDone, tasks_total: ALL_TASKS.length,
    current_week: state === "now" ? { n: week.n, title: week.title } : null,
  };
}

export async function getActivity(limit = 30) {
  const n = Math.max(1, Math.min(200, Number(limit) || 30));
  return (await lrange(K.activity, 0, n - 1)).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
}

// Writes -------------------------------------------------------------------
export async function logSale({ offer, amount, client, date, month, actor, source = "dashboard", note }) {
  const o = findOffer(offer);
  const d = normDate(date, month ? normMonth(month) : (date ? String(date).slice(0, 7) : currentMonth()));
  const m = normMonth(d.slice(0, 7));
  const amt = amount == null || amount === "" ? o.price : Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 1 || amt > 1_000_000) throw new OrbitError("amount must be a whole dollar figure between 1 and 1,000,000");
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const entry = { id, offer: o.id, amount: amt, who: clean(client, 80), note: clean(note, 200), date: d,
    actor: clean(actor || "unknown", 60), source: clean(source, 20), created: new Date().toISOString() };
  await hset(K.logs(m), id, JSON.stringify(entry));
  await record({ type: "sale_logged", month: m, actor: entry.actor, source: entry.source,
    summary: `${entry.actor} logged $${amt.toLocaleString("en-US")} for ${o.name}${entry.who ? " (" + entry.who + ")" : ""}`, entry });
  return { entry, ...(await getMonth(m)) };
}

export async function removeSale({ month, id, actor, source = "dashboard" }) {
  const m = normMonth(month);
  const all = await hgetall(K.logs(m));
  if (!all[id]) throw new OrbitError(`No sale with id "${id}" in ${m}`, 404);
  const old = JSON.parse(all[id]);
  await hdel(K.logs(m), id);
  await record({ type: "sale_removed", month: m, actor: clean(actor || "unknown", 60), source,
    summary: `${clean(actor || "unknown", 60)} removed a $${Number(old.amount).toLocaleString("en-US")} ${old.offer} entry`, entry: old });
  return getMonth(m);
}

export async function setTask({ month, task_id, done = true, actor, source = "dashboard", note }) {
  const m = normMonth(month);
  const t = findTask(task_id);
  const who = clean(actor || "unknown", 60);
  if (done) await hset(K.done(m), t.id, JSON.stringify({ done: true, by: who, at: new Date().toISOString(), note: clean(note, 200) }));
  else await hdel(K.done(m), t.id);
  await record({ type: done ? "task_done" : "task_reopened", month: m, actor: who, source,
    summary: `${who} ${done ? "completed" : "reopened"}: ${t.text}`, task: t });
  return getMonth(m);
}

export async function logActivity({ summary, actor, source = "agent", month }) {
  const s = clean(summary, 400);
  if (!s) throw new OrbitError("summary is required");
  return record({ type: "note", month: normMonth(month), actor: clean(actor || "unknown", 60), source, summary: s });
}
