# Net Positive Memory: engine specification (net-positive-memory-mcp)

The file-direct memory server behind the net-positive-memory plugin. Reads and writes a folder of markdown notes, derives a graph from their links, and exposes both over MCP. No Obsidian dependency; Obsidian-compatible output. CPU-only.

Status of this document: build spec. Section 1 is the authoritative data model; the skill's `schema.md` is a condensed copy of it and must agree.

---

## 1. Data model (the contract)

### 1.1 File format
- UTF-8, LF line endings.
- YAML frontmatter delimited by `---` on the first line and a closing `---`. Body is markdown after the closing fence.
- Engine round-trips unknown content untouched. On write it emits frontmatter in canonical key order (below), then custom keys in insertion order, then the body.

### 1.2 Core frontmatter fields
| Key | Required | Type | Rule |
|---|---|---|---|
| `type` | yes | enum | one of `project`, `entity`, `decision`, `session`, `concept`, `reference` |
| `status` | yes | enum | one of `active`, `parked`, `archived` |
| `created` | yes | date | `YYYY-MM-DD`. Engine sets it on first write if absent. |
| `updated` | yes | date | `YYYY-MM-DD`. Engine refreshes it on every mutating op. |
| `summary` | yes | string | one sentence. Primary search payload. |
| `tags` | no | list[str] | lower case, hyphenated, no leading `#` |
| `related` | no | list[str] | each item a `"[[wikilink]]"`. Default (untyped) edges. |
| `aliases` | no | list[str] | extra wikilink targets that resolve to this note |

Required-field policy: on write, if `type`, `status` or `summary` are missing the engine rejects with a clear error rather than guessing. `created`/`updated` are auto-filled. This keeps the store queryable; a note with no `type` or `summary` is invisible to the cheap search rungs.

### 1.3 Custom fields (extensibility)
Any other key is allowed. The engine stores it, round-trips it, and exposes it to structured search `where` filters. Custom keys are ignored by graph derivation unless they match the typed-edge rule below. This is how a richer vault (for example a risk register with scoring fields) layers on without bloating the core.

### 1.4 Edge model
Edges are directed, from the current note outward. Three sources:
1. `related` list -> edges of type `related`.
2. Inline `[[wikilink]]` in the body -> edges of type `mention`.
3. Typed edges: any frontmatter key whose value is a list of `[[wikilinks]]` becomes edges of type = that key. Example: `hosts: ["[[runtime]]"]` yields a `hosts` edge. No new syntax to learn; a typed edge is just a frontmatter list of links. `related` is the generic case of this rule.

### 1.5 Wikilink resolution
- `[[Target]]` resolves to the note whose filename stem (no `.md`) equals `Target`, case-insensitively, or whose `aliases` contains `Target`.
- `[[Target|Display]]`: `Target` resolves; `Display` is ignored for the graph.
- Resolution is name-based, not path-based (Obsidian default). Filename stems should be unique across the store; duplicate stems make resolution ambiguous and the engine warns.
- An unresolved target becomes a dangling edge to a placeholder node, so `graph_*` can surface "referenced but missing" notes.

### 1.6 Node identity
- Canonical id = store-relative path, e.g. `entities/bifrost.md`.
- Human handle = wikilink target = filename stem.
- New notes the engine creates are slugged: lower case, hyphens, no spaces. Existing names are respected; resolution is case-insensitive on the stem.

### 1.7 Sections (patch anchors)
- A section is an ATX heading (`#`..`######`) and its content up to the next heading of equal or higher level.
- Patch targets either a heading's section or a frontmatter key. Block-level anchors are deferred to a later version.

### 1.8 Folder layout
`INDEX.md` at root; `entities/`, `projects/`, `decisions/`, `sessions/`; optional `concepts/`, `reference/`. `INDEX.md` is an ordinary `reference` note maintained by the skill, not the engine; search may rank it first.

### 1.9 Decisions made here (overrule if wanted)
- Auto-timestamps: engine owns `created`/`updated`. The skill no longer asks the model to bump them.
- Typed edges via frontmatter-list-of-wikilinks, rather than an inline `key:: [[x]]` syntax.
- Custom fields permitted and searchable; only link-list fields affect the graph.
- `vault_search` excludes `status: archived` by default.
- Required fields are `type`, `status`, `summary`; everything else optional or auto-filled.

---

## 2. Architecture

```
            MCP (stdio)
                |
        +-------v--------+
        |  tool handlers |
        +---+--------+---+
            |        |
     +------v--+  +--v---------+
     | file IO |  | index +    |
     | (md r/w)|  | graph (mem)|
     +----+----+  +--+---------+
          |          |
     +----v----------v----+
     |  MEMORY_PATH folder |  <- source of truth (also an Obsidian vault)
     +---------------------+
```

- Source of truth is the folder. Everything else is derived and rebuildable.
- On start, the engine scans the folder, parses frontmatter and links, and builds two in-memory structures: a note index (path -> parsed note) and a NetworkX `DiGraph`.
- A file watcher (watchfiles) reindexes changed files incrementally so external edits (Obsidian, git, sync) stay reflected. If watching is unavailable, a `vault_reindex` tool forces a rescan.
- No database process. The index lives in memory; cold-start parse of a few thousand small notes is sub-second. Persisting the index to a sidecar cache file is an optional optimisation, not required.

## 3. Tool contract

All tools are namespaced by the server. Returns are compact JSON. "Note ref" below = `{path, type, status, summary}` (no body).

Read / search (cheap, body-free unless stated):
- `tag_list() -> [{tag, count}]`
- `vault_list(directory?) -> [path]` (dirs end with `/`)
- `vault_search(query?, where?, include_archived=false, limit=20) -> [note ref]`
  - `where`: structured filter over frontmatter, e.g. `{"type":"decision","status":{"!=":"archived"}}`. Supports `=`, `!=`, `in`, `contains` (for list fields like `tags`).
  - `query`: plain text matched against summary + body when present.
  - Default excludes archived unless `include_archived` or `where` says otherwise.
- `vault_read(path, format="content") -> {frontmatter, body}` or `format="metadata" -> {frontmatter, tags, stat}` (no body). The only tool that returns bodies.

Graph (body-free; returns refs + edges):
- `graph_neighbours(note, depth=1, edge_types?) -> {nodes:[note ref], edges:[{from,to,type}]}`
- `graph_path(a, b, max_depth=6) -> {path:[note ref], edges:[...]}` or null
- `graph_subgraph(seed|tag, depth=1) -> {nodes, edges}`
- `graph_backlinks(note) -> [{from:note ref, type}]`

Write (mutating; engine bumps `updated`, sets `created` if absent):
- `vault_write(path, frontmatter, body, overwrite=false) -> {path}`. Rejects if required fields missing. Refuses to clobber unless `overwrite`.
- `vault_append(path, text) -> {path}`. Appends to body; creates note only if `create=true` with valid frontmatter.
- `vault_patch(path, target, content) -> {path}`. `target` = `{"heading":"..."}` or `{"frontmatter":"key"}`.
- `vault_delete(path, confirm=true) -> {path, deleted}`. Hard delete; see skill `delete.md` for archive-first policy. Returns the backlinks it found so callers can fix dangling edges.

Admin:
- `vault_reindex() -> {notes, edges}` forces a rescan.

## 4. Parsing and indexing

- Frontmatter: parse with a YAML loader (safe load). Validate enums and required fields on write only; on read, tolerate and surface as-is so a messy existing vault still loads.
- Links: regex for `[[...]]` in body for `mention` edges; walk frontmatter for `related` and typed link-list fields.
- Slug/resolution table: build a map of stem (lower) and each alias -> path, for wikilink resolution. Flag duplicate stems.
- Index shape: `{path: Note}` where `Note = {path, frontmatter, body, out_edges, tags}`. Graph nodes carry `{path, type, status, summary}` as attributes so graph results need no extra reads.

## 5. Search implementation

- Structured first: evaluate `where` against parsed frontmatter in memory. No external query engine; a small operator set (`=`,`!=`,`in`,`contains`) covers the retrieval ladder.
- Text: case-insensitive substring (or a tiny BM25 over summary+body if wanted later) for the plain-text rung.
- Always return refs (with `summary`), never bodies, so the ladder stays cheap until `vault_read`.
- Archived excluded by default.

## 6. Graph derivation

- Build a `networkx.DiGraph`. Add a node per note with its ref attributes. Add an edge per derived link with a `type` attribute. Add placeholder nodes for dangling targets, marked `missing=true`.
- `graph_neighbours` = ego graph at radius `depth`, optionally filtered by `edge_types`.
- `graph_path` = shortest path (treat as undirected for reachability unless a `directed=true` flag is set).
- `graph_subgraph` = union of ego graphs from the seed set (a note, or all notes carrying a tag).
- `graph_backlinks` = in-edges of the node.
- All graph tools return nodes as refs plus the edge list, so a caller gets structure plus `summary` lines without reading a single body.

## 7. Write semantics

- Timestamps: set `created` (today) if absent on first write; set `updated` (today) on every write/append/patch.
- Canonical frontmatter order on emit: `type, status, tags, created, updated, summary, related, aliases`, then custom keys.
- Atomic writes: write to a temp file in the same folder, then replace, to avoid half-written notes if a sync engine reads mid-write.
- After any mutation, update the in-memory index and graph for the affected note(s) without a full rescan.

## 8. Config and packaging

- Config: `MEMORY_PATH` env = store folder (required). Optional `MEMORY_WATCH=0` to disable the watcher.
- Distribution: published to PyPI as `net-positive-memory-mcp`, launched with `uvx net-positive-memory-mcp`, which is the one-liner the plugin's `.mcp.json` and the setup script already target.
- Dependencies: an MCP server SDK, `pyyaml`, `networkx`, `watchfiles` (optional). All pure-Python or small native wheels; no GPU, no Obsidian, no database.
- Runtime footprint: a long-lived CPU process holding the index in memory; suitable for an always-on host or a local desktop alike.

## 9. Concurrency and conflict

- Assume a single logical writer at a time for a given note. The watcher keeps the index honest when an external editor or sync writes a file.
- Atomic temp-file replace avoids torn reads. The engine does not attempt merge; last write wins, same as the underlying file system and sync layer.

## 10. Build order

1. File IO + frontmatter parse/emit + the four write tools and `vault_read`/`vault_list`. Usable store, no graph.
2. Index + `vault_search` (structured then text) + `tag_list`. The retrieval ladder works.
3. NetworkX graph + the four `graph_*` tools.
4. Watcher + `vault_reindex`; atomic writes; auto-timestamps.
5. Package for PyPI/uvx; wire into the plugin's `.mcp.json`; confirm the setup script's staged config launches it.

Milestone 1 alone makes the plugin functional end to end; the rest is additive and each step ships independently.
