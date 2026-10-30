// Shared auth + body helpers for the Vercel functions.
import { timingSafeEqual } from "node:crypto";

export function authorize(req) {
  const key = process.env.ORBIT_API_KEY;
  if (!key) {
    // Open only outside production so local dev works without setup.
    if (process.env.VERCEL_ENV === "production") return { ok: false, status: 503, error: "Server is missing ORBIT_API_KEY. Add it in Vercel → Settings → Environment Variables." };
    return { ok: true };
  }
  const h = String(req.headers.authorization || "");
  const given = h.startsWith("Bearer ") ? h.slice(7) : String(req.headers["x-orbit-key"] || "");
  const a = Buffer.from(given), b = Buffer.from(key);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, status: 401, error: "Missing or wrong team key." };
  return { ok: true };
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
