// Local dev server: serves the dashboard and runs the /api functions the
// same way Vercel does, without needing the Vercel CLI.
//   npm run dev  →  http://localhost:3000   (MCP at http://localhost:3000/mcp)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT || 3000);
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".svg": "image/svg+xml", ".md": "text/markdown" };
const routes = { "/api/state": "../api/state.js", "/api/mcp": "../api/mcp.js", "/mcp": "../api/mcp.js" };

export function createServer() {
  return http.createServer(async (req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    if (routes[path]) {
      const mod = await import(routes[path]);
      return mod.default(req, res);
    }
    const rel = normalize(path === "/" ? "/index.html" : path).replace(/^(\.\.[/\\])+/, "");
    if (!/^\/(index\.html|lib\/plan\.js|favicon\.svg)$/.test(rel)) { res.statusCode = 404; return res.end("Not found"); }
    try {
      const data = await readFile(join(root, rel));
      res.setHeader("Content-Type", types[extname(rel)] || "application/octet-stream");
      res.end(data);
    } catch { res.statusCode = 404; res.end("Not found"); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(port, () => console.log(`Revenue Orbit on http://localhost:${port}  (MCP: http://localhost:${port}/mcp)`));
}
