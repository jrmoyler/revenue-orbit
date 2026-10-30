# Revenue Orbit

A live 3D tracker for the **$21,100 monthly target**. Nine service offers orbit a core that fills as payments land. The team works it from the dashboard, and LLMs and agents work it through an MCP server, so every sale, finished playbook task and progress note shows up in one feed.

- **Dashboard** — `index.html` (Three.js, no build step)
- **Plan** — `lib/plan.js`: target, offers, prices, quantities and the four-week playbook. Edit this one file to change the plan everywhere.
- **REST API** — `api/state.js` at `/api/state`, used by the dashboard
- **MCP server** — `api/mcp.js` at `/mcp`, for Claude, other LLMs and agents
- **Storage** — Upstash Redis through Vercel's Marketplace (`lib/store.js`)
- **Vault bridge** — optional mirroring of every event into the Collective Vault (`lib/vault.js`)

## Deploy to Vercel

1. **Import the repo.** Vercel → Add New → Project → `jrmoyler/revenue-orbit`. Framework preset: **Other**. No build command, no output directory.
2. **Add storage.** Project → Storage → Create → **Upstash for Redis** (Marketplace) → connect it to this project. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Set the team key.** Project → Settings → Environment Variables → add `ORBIT_API_KEY` with a long random value (for example the output of `openssl rand -hex 32`). Everyone on the team and every agent uses this key.
4. **Redeploy** so the new variables load.
5. Open the site, enter your name and the team key. Your name goes on everything you log.

Without `ORBIT_API_KEY`, production refuses all requests. Preview and local runs stay open so you can test.

## Connect LLMs and agents (MCP)

| Setting | Value |
| --- | --- |
| URL | `https://<your-domain>/mcp` |
| Transport | Streamable HTTP |
| Header | `Authorization: Bearer <ORBIT_API_KEY>` |

**Claude Code**

```bash
claude mcp add --transport http revenue-orbit https://<your-domain>/mcp \
  --header "Authorization: Bearer $ORBIT_API_KEY"
```

**Cursor, Windsurf and other JSON-config clients**

```json
{
  "mcpServers": {
    "revenue-orbit": {
      "url": "https://<your-domain>/mcp",
      "headers": { "Authorization": "Bearer <ORBIT_API_KEY>" }
    }
  }
}
```

**Claude.ai custom connectors** expect OAuth or no auth, so a bearer header may not be accepted there. Use Claude Code, Claude Desktop with a local proxy such as `npx mcp-remote https://<your-domain>/mcp --header "Authorization: Bearer <key>"`, or another client that sends headers.

### Tools

| Tool | What it does |
| --- | --- |
| `get_month` | Collected vs target, pace, needed per day, per-offer progress, playbook with done state, logged sales |
| `list_offers` | Offer ids, prices, planned quantities, pitch, proof, buyer |
| `log_sale` | Record a collected payment (amount defaults to list price) |
| `remove_sale` | Delete a mistaken entry by id |
| `complete_task` | Mark a playbook task done or reopen it |
| `log_activity` | Add a progress note (calls booked, proposals sent) |
| `get_activity` | Recent team and agent activity |

Every write takes an `actor` so the dashboard shows who did it. Agent writes are tagged **agent** in the activity feed. See [AGENTS.md](AGENTS.md) for the working rules agents follow.

### REST (for scripts, Zapier, n8n)

```bash
# Read a month
curl -H "Authorization: Bearer $ORBIT_API_KEY" "https://<your-domain>/api/state?month=2026-11"

# Log a sale
curl -X POST -H "Authorization: Bearer $ORBIT_API_KEY" -H "Content-Type: application/json" \
  -d '{"action":"log_sale","offer":"web","amount":2500,"client":"Short North boutique","actor":"JR"}' \
  https://<your-domain>/api/state
```

Actions: `log_sale`, `remove_sale` (`month`, `id`), `set_task` (`task_id`, `done`), `note` (`summary`).

## Mirror events into the Collective Vault

Set these in Vercel to forward every Orbit event to the Vault's MCP server as a `vault_log` call:

| Variable | Purpose |
| --- | --- |
| `VAULT_MCP_URL` | The Vault's MCP endpoint |
| `VAULT_MCP_TOKEN` | Bearer token for it, if required |
| `VAULT_LOG_TOOL` | Tool to call (default `vault_log`) |
| `VAULT_LOG_FIELD` | Argument that receives the text (default `entry`) |
| `VAULT_LOG_EXTRA` | JSON merged into the arguments, e.g. `{"tags":["revenue-orbit"]}` |

Check the Vault's `vault_log` input schema and set `VAULT_LOG_FIELD` and `VAULT_LOG_EXTRA` to match. Forwarding is best effort: a Vault outage never blocks a sale from saving. If you leave `VAULT_MCP_URL` empty, agents connected to both servers mirror entries themselves (see AGENTS.md).

## Run locally

```bash
npm run dev     # http://localhost:3000, MCP at http://localhost:3000/mcp
npm test        # end-to-end check of the API and MCP server
```

Local runs use in-memory storage unless you put the Redis variables in your shell. Copy `.env.example` for the full list.

## Change the plan

Edit `lib/plan.js`: offer prices and quantities, the target, the bills floor or the playbook tasks. Keep task ids stable once a month has started, since done state is stored by id.
