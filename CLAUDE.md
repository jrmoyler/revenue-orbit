# Revenue Orbit

Static Three.js dashboard (`index.html`) plus Vercel Node functions (`api/`). No build step and no npm dependencies.

- The plan (target, offers, playbook) lives only in `lib/plan.js`. The page imports it as an ES module and the API imports it too.
- All reads and writes go through `lib/orbit.js`. Both `api/state.js` (dashboard) and `api/mcp.js` (agents) call it.
- `lib/store.js` talks to Upstash Redis over REST and falls back to memory when the env vars are missing.
- Run `npm test` after any change to `lib/` or `api/`.
- Agent working rules for the MCP tools are in `AGENTS.md`.
