// Optional bridge: mirror every Orbit event into the Collective Vault.
//
// If VAULT_MCP_URL is set, each event is sent to that MCP server as a
// tools/call of VAULT_LOG_TOOL (default "vault_log"). The event text goes
// in the argument named by VAULT_LOG_FIELD (default "entry"), and any JSON
// in VAULT_LOG_EXTRA is merged into the arguments. Check the Vault's
// vault_log schema and set these to match. Leave VAULT_MCP_URL empty to
// turn the bridge off; agents can still log to both servers themselves.

export async function forwardToVault(evt) {
  const url = process.env.VAULT_MCP_URL;
  if (!url) return;
  const tool = process.env.VAULT_LOG_TOOL || "vault_log";
  const field = process.env.VAULT_LOG_FIELD || "entry";
  let extra = {};
  try { extra = JSON.parse(process.env.VAULT_LOG_EXTRA || "{}"); } catch {}
  const text = `[Revenue Orbit · ${evt.month}] ${evt.summary}`;
  const headers = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
  if (process.env.VAULT_MCP_TOKEN) headers.Authorization = `Bearer ${process.env.VAULT_MCP_TOKEN}`;

  const rpc = async (body, sessionId) => {
    const h = { ...headers };
    if (sessionId) h["Mcp-Session-Id"] = sessionId;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try { return await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body), signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
  };

  const init = await rpc({ jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "revenue-orbit", version: "1.0.0" } } });
  const sid = init.headers.get("mcp-session-id") || undefined;
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, sid);
  await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: tool, arguments: { ...extra, [field]: text } } }, sid);
}
