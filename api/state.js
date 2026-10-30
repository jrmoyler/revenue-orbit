// REST endpoint used by the dashboard.
//   GET  /api/state?month=YYYY-MM          → month logs, tasks, summary, recent activity
//   POST /api/state {action, ...}          → log_sale | remove_sale | set_task | note
import { authorize, readJson, send } from "../lib/http.js";
import { getMonth, getActivity, logSale, removeSale, setTask, logActivity, OrbitError } from "../lib/orbit.js";

export default async function handler(req, res) {
  const auth = authorize(req);
  if (!auth.ok) return send(res, auth.status, { error: auth.error });
  try {
    const url = new URL(req.url, "http://x");
    if (req.method === "GET") {
      const month = url.searchParams.get("month");
      const [state, activity] = await Promise.all([getMonth(month), getActivity(25)]);
      return send(res, 200, { ...state, activity });
    }
    if (req.method === "POST") {
      const b = await readJson(req);
      if (!b) return send(res, 400, { error: "Body must be JSON." });
      const actor = b.actor || "dashboard";
      let state;
      switch (b.action) {
        case "log_sale": state = await logSale({ ...b, actor, source: "dashboard" }); break;
        case "remove_sale": state = await removeSale({ month: b.month, id: b.id, actor, source: "dashboard" }); break;
        case "set_task": state = await setTask({ month: b.month, task_id: b.task_id, done: b.done !== false, actor, source: "dashboard" }); break;
        case "note": await logActivity({ summary: b.summary, actor, source: "dashboard", month: b.month }); state = await getMonth(b.month); break;
        default: return send(res, 400, { error: "Unknown action. Use log_sale, remove_sale, set_task or note." });
      }
      const activity = await getActivity(25);
      return send(res, 200, { ...state, activity });
    }
    return send(res, 405, { error: "Use GET or POST." }, { Allow: "GET, POST" });
  } catch (e) {
    if (e instanceof OrbitError) return send(res, e.status, { error: e.message });
    console.error(e);
    return send(res, 500, { error: "Server error: " + (e.message || "unknown") });
  }
}
