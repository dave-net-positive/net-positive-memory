// Net Positive Memory: MCP server (Node). Wraps store.js and exposes 13 tools.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { Store, StoreError } from "./store.js";

const INSTRUCTIONS = `Net Positive Memory is a markdown memory the user carries between chats. The notes are the source of truth; the graph is derived.

Retrieval ladder, cheapest first: vault_search (filter by frontmatter + text) -> vault_read the few that matter -> graph_neighbours / graph_backlinks only when you need connections. Never read the whole vault.

Every note needs frontmatter: type (project|entity|decision|session|concept|reference), status (active|parked|archived), summary (one sentence). The engine sets created and updated; never write them by hand. Links are [[wikilinks]]; a frontmatter field whose value is a list of wikilinks is a typed edge (use related for the generic case).

Write sparingly and durably: capture decisions, entities, and state that will matter next time, not chat chatter. Prefer vault_patch or vault_append over rewriting. vault_search hides archived notes by default.`;

const server = new McpServer({ name: "net-positive-memory", version: "0.1.0" }, { instructions: INSTRUCTIONS });

let store = null;
function getStore() {
  if (!store) {
    const p = process.env.MEMORY_PATH;
    if (!p) throw new StoreError("MEMORY_PATH is not set. The extension should provide it from your chosen memory folder.");
    store = new Store(p);
    store.startWatch();
  }
  return store;
}

function ok(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }], structuredContent: obj };
}

function tool(name, description, shape, fn) {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => {
    try {
      return ok(fn(args || {}));
    } catch (e) {
      const msg = e instanceof StoreError ? e.message : `unexpected error: ${e && e.message ? e.message : e}`;
      return { content: [{ type: "text", text: msg }], isError: true };
    }
  });
}

const dict = () => z.record(z.any());

tool("vault_read", "Read one note. format 'content' (default) returns frontmatter + body; 'metadata' returns frontmatter, tags and file stat only.",
  { path: z.string(), format: z.enum(["content", "metadata"]).optional() },
  (a) => getStore().read(a.path, a.format || "content"));

tool("vault_list", "List entries in a folder (directories end with /). Empty path lists the root.",
  { path: z.string().optional() },
  (a) => ({ entries: getStore().list(a.path || "") }));

tool("vault_write", "Create a note (or overwrite with overwrite=true). frontmatter must include type, status and summary; created/updated are set for you.",
  { path: z.string(), frontmatter: dict(), body: z.string().optional(), overwrite: z.boolean().optional() },
  (a) => getStore().write(a.path, a.frontmatter, a.body || "", a.overwrite || false));

tool("vault_append", "Append text to a note's body. create=true makes the note first (pass frontmatter for that case).",
  { path: z.string(), text: z.string(), create: z.boolean().optional(), frontmatter: dict().optional() },
  (a) => getStore().append(a.path, a.text, a.create || false, a.frontmatter || null));

tool("vault_patch", "Replace one section in place. target is {heading: 'Name'} for a body section or {frontmatter: 'key'} for a field.",
  { path: z.string(), target: dict(), content: z.any() },
  (a) => getStore().patch(a.path, a.target, a.content));

tool("vault_delete", "Delete a note. confirm=false returns the note's backlinks without deleting, so you can check what would break first.",
  { path: z.string(), confirm: z.boolean().optional() },
  (a) => getStore().delete(a.path, a.confirm === undefined ? true : a.confirm));

tool("vault_search", "Find notes by frontmatter and text. where maps fields to a value or {op: value} (ops: =, !=, in, contains, <, <=, >, >=). Archived hidden unless include_archived=true.",
  { query: z.string().optional(), where: dict().optional(), include_archived: z.boolean().optional(), limit: z.number().optional() },
  (a) => getStore().search(a.query || null, a.where || null, a.include_archived || false, a.limit === undefined ? 20 : a.limit));

tool("tag_list", "List every tag in use with counts, most used first.",
  { include_archived: z.boolean().optional() },
  (a) => getStore().tagList(a.include_archived || false));

tool("graph_neighbours", "Notes within depth hops of a note. edge_types filters to specific link kinds (e.g. ['related']).",
  { note: z.string(), depth: z.number().optional(), edge_types: z.array(z.string()).optional() },
  (a) => getStore().graphNeighbours(a.note, a.depth === undefined ? 1 : a.depth, a.edge_types || null));

tool("graph_path", "Shortest link path between two notes. directed=true follows link direction only.",
  { from: z.string(), to: z.string(), max_depth: z.number().optional(), directed: z.boolean().optional() },
  (a) => getStore().graphPath(a.from, a.to, a.max_depth === undefined ? 6 : a.max_depth, a.directed || false));

tool("graph_subgraph", "The connected cluster around a seed note and/or every note carrying a tag.",
  { seed: z.string().optional(), tag: z.string().optional(), depth: z.number().optional() },
  (a) => getStore().graphSubgraph(a.seed || null, a.tag || null, a.depth === undefined ? 1 : a.depth));

tool("graph_backlinks", "Notes that link to this note, with the edge type of each link.",
  { note: z.string() },
  (a) => getStore().graphBacklinks(a.note));

tool("vault_reindex", "Rebuild the in-memory index and graph from disk. Use after bulk external edits.",
  {},
  () => getStore().reindex());

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("fatal:", e);
  process.exit(1);
});
