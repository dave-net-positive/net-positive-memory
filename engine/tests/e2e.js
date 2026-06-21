// End-to-end: drive the bundled server over MCP stdio. Run: node tests/e2e.js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, "..", "build", "server", "index.cjs");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "npmem-e2e-"));

let pass = 0, fail = 0;
const check = (n, c) => { if (c) { pass++; } else { fail++; console.error("FAIL:", n); } };
const data = (r) => r.structuredContent ?? JSON.parse(r.content[0].text);

const transport = new StdioClientTransport({ command: "node", args: [serverPath], env: { ...process.env, MEMORY_PATH: dir } });
const client = new Client({ name: "e2e", version: "1.0.0" });
await client.connect(transport);

const init = client.getServerVersion();
check("server identifies itself", init && init.name === "net-positive-memory");
const instr = client.getInstructions();
check("server ships governance instructions", typeof instr === "string" && instr.includes("Retrieval ladder"));

const tools = (await client.listTools()).tools;
const names = tools.map((t) => t.name).sort();
const expected = ["graph_backlinks", "graph_neighbours", "graph_path", "graph_subgraph", "tag_list", "vault_append", "vault_delete", "vault_list", "vault_patch", "vault_read", "vault_reindex", "vault_search", "vault_write"];
check(`all 13 tools present (${names.length})`, JSON.stringify(names) === JSON.stringify(expected));

let r = await client.callTool({ name: "vault_write", arguments: { path: "entities/bifrost", frontmatter: { type: "entity", status: "active", summary: "Always-on VPS" }, body: "# Bifrost\n\nHosts [[openthor]]." } });
check("vault_write ok", data(r).path === "entities/bifrost.md");

r = await client.callTool({ name: "vault_write", arguments: { path: "openthor", frontmatter: { type: "project", status: "active", summary: "Agent stack", related: ["[[bifrost]]"] }, body: "Runs on [[bifrost]]." } });
check("second write ok", data(r).path === "openthor.md");

r = await client.callTool({ name: "vault_read", arguments: { path: "openthor" } });
check("vault_read returns frontmatter", data(r).frontmatter.type === "project");
check("vault_read set updated", typeof data(r).frontmatter.updated === "string");

r = await client.callTool({ name: "vault_search", arguments: { where: { type: "entity" } } });
check("vault_search by type", data(r).results.some((x) => x.path === "entities/bifrost.md"));

r = await client.callTool({ name: "vault_append", arguments: { path: "openthor", text: "Extra line." } });
r = await client.callTool({ name: "vault_read", arguments: { path: "openthor" } });
check("vault_append added text", data(r).body.includes("Extra line."));

r = await client.callTool({ name: "vault_patch", arguments: { path: "openthor", target: { frontmatter: "status" }, content: "parked" } });
check("vault_patch frontmatter", data(r).path === "openthor.md");

r = await client.callTool({ name: "graph_neighbours", arguments: { note: "openthor", depth: 1 } });
check("graph_neighbours reaches bifrost", data(r).nodes.some((n) => n.path === "entities/bifrost.md"));

r = await client.callTool({ name: "graph_backlinks", arguments: { note: "bifrost" } });
check("graph_backlinks finds openthor", data(r).backlinks.some((b) => b.from.path === "openthor.md"));

r = await client.callTool({ name: "graph_path", arguments: { from: "openthor", to: "bifrost" } });
check("graph_path links the two", data(r).path.length === 2);

r = await client.callTool({ name: "tag_list", arguments: {} });
check("tag_list returns object", Array.isArray(data(r).tags));

r = await client.callTool({ name: "vault_reindex", arguments: {} });
check("vault_reindex counts notes", data(r).notes === 2);

// error path
r = await client.callTool({ name: "vault_read", arguments: { path: "does-not-exist" } });
check("missing note returns isError", r.isError === true && /not found/.test(r.content[0].text));

r = await client.callTool({ name: "vault_write", arguments: { path: "bad", frontmatter: { type: "bogus", status: "active", summary: "s" } } });
check("bad enum returns isError", r.isError === true && /invalid type/.test(r.content[0].text));

await client.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
