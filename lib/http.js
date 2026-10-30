// Shared auth + body helpers for the Vercel functions.
import { timingSafeEqual } from "node:crypto";

const same = (given, key) => {
  const a = Buffer.from(given), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
};

// ORBIT_API_KEY is the owner key (sees private bills). ORBIT_TEAM_KEYS is a comma-separated
// list of teammate keys: same shared data and playbook, never the bills.
// Returns {ok, owner}; `owner` is the only thing that unlocks owner-only data.
export function authorize(req) {
  const key = process.env.ORBIT_API_KEY;
  if (!key) {
    // Open only outside production so local dev works without setup.
    if (process.env.VERCEL_ENV === "production") return { ok: false, status: 503, error: "Server is missing ORBIT_API_KEY. Add it in Vercel → Settings → Environment Variables." };
    return { ok: true, owner: true };
  }
  const h = String(req.headers.authorization || "");
  const given = h.startsWith("Bearer ") ? h.slice(7) : String(req.headers["x-orbit-key"] || "");
  if (same(given, key)) return { ok: true, owner: true };
  const team = String(process.env.ORBIT_TEAM_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
  // Check every key (no early exit) so timing doesn't reveal which one matched.
  if (team.map(k => same(given, k)).includes(true)) return { ok: true, owner: false };
  return { ok: false, status: 401, error: "Missing or wrong team key." };
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return null; } }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

export function send(res, status, data, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(data === undefined ? "" : JSON.stringify(data));
}
