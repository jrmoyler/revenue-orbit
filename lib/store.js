// Storage: Upstash Redis over its REST API (what Vercel's Redis/KV
// Marketplace integration provisions). No SDK needed — plain fetch.
// Without credentials it falls back to in-memory storage, which is only
// for local development (data resets when the process restarts).

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
export const persistent = Boolean(URL_ && TOKEN);

const mem = globalThis.__orbitMem || (globalThis.__orbitMem = new Map());

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("Storage error: " + (j.error || r.status));
  return j.result;
}

// Hash helpers -------------------------------------------------------------
export async function hset(key, field, value) {
  if (!persistent) { (mem.get(key) || mem.set(key, new Map()).get(key)).set(field, value); return; }
  await redis(["HSET", key, field, value]);
}
export async function hdel(key, field) {
  if (!persistent) { const h = mem.get(key); return h && h.delete(field) ? 1 : 0; }
  return redis(["HDEL", key, field]);
}
export async function hgetall(key) {
  if (!persistent) return Object.fromEntries(mem.get(key) || []);
  const arr = (await redis(["HGETALL", key])) || [];
  const out = {};
  for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
  return out;
}

// Capped activity list -----------------------------------------------------
export async function lpushCapped(key, value, cap = 300) {
  if (!persistent) { const l = mem.get(key) || []; l.unshift(value); mem.set(key, l.slice(0, cap)); return; }
  await redis(["LPUSH", key, value]);
  await redis(["LTRIM", key, 0, cap - 1]);
}
export async function lrange(key, start, stop) {
  if (!persistent) return (mem.get(key) || []).slice(start, stop + 1);
  return (await redis(["LRANGE", key, start, stop])) || [];
}
