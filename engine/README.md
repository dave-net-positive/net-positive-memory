# Net Positive Memory: engine

The memory engine: a file-direct Markdown store served over the Model Context Protocol, packaged as a `.mcpb` Desktop Extension. It reads and writes a folder of Markdown notes and exposes a small, typed tool surface plus a link graph derived from `[[wikilinks]]`.

Written in Node so it runs on the Node runtime that ships inside Claude Desktop, which means a true zero-prerequisite install for end users.

## Layout

```
engine/
├── src/
│   ├── store.js     core logic: parse/emit, CRUD, search, graph (no MCP dependency, unit-testable)
│   └── index.js     MCP server: wraps the store, registers the 13 tools, ships governance instructions
├── tests/
│   ├── test_store.js  store parity suite
│   └── e2e.js         end-to-end test over MCP stdio against the bundled server
├── scripts/build.mjs  bundle + assemble dist/ for packing
├── manifest.json      .mcpb manifest (server config + user_config folder picker)
└── icon.png           bundle icon
```

## Develop

```bash
npm install
npm test        # store parity suite
npm run e2e     # bundle, then drive the server over MCP stdio
```

## Build the .mcpb

```bash
npm install -g @anthropic-ai/mcpb   # one-time: the packaging CLI
npm run build                       # bundles to a single dist/server/index.cjs and assembles dist/
npm run pack                        # validates the manifest and writes ../net-positive-memory.mcpb
```

The bundle is a single self-contained CommonJS file plus the manifest and icon. No `node_modules` ships inside it.

## Configuration

The server reads two environment variables, which the `.mcpb` supplies from the user's choices at install time:

| Variable | Meaning |
|---|---|
| `MEMORY_PATH` | The folder the notes live in. Required. Created if missing; never restructured or wiped. |
| `MEMORY_WATCH` | `1`/`true` to watch the folder for outside edits. Optional; off by default (the index re-reads by mtime on each call anyway). |

## The tools

`vault_read`, `vault_list`, `vault_write`, `vault_append`, `vault_patch`, `vault_delete`, `vault_search`, `tag_list`, `graph_neighbours`, `graph_path`, `graph_subgraph`, `graph_backlinks`, `vault_reindex`. See [`../docs/tools.md`](../docs/tools.md) and the data-model contract in [`../docs/data-model.md`](../docs/data-model.md).

## Licence

MIT.
