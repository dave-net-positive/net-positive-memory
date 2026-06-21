# Architecture

Net Positive Memory is three small pieces around one idea: **plain Markdown files you own are the memory; everything else is derived and replaceable.**

## The pieces

**Engine** (`engine/`). A Node MCP server that reads and writes a folder of Markdown notes and exposes the 13 tools plus a link graph. It owns timestamps and enforces the frontmatter contract on every write. It is packaged as a `.mcpb` Desktop Extension so installing it is a double-click and a folder pick, with no runtime to install, because Claude Desktop ships the Node runtime the engine needs. The engine also ships a condensed version of the usage discipline in its MCP `instructions`, so it behaves sensibly even with no skill present.

**Skill** (`skill/`). The judgement layer: when to record something, how to retrieve it cheaply, how to keep it tidy. A lean `SKILL.md` with per-operation detail in `references/` that loads only when needed. It carries no engine and no installer; it simply teaches Claude to use whatever memory tools are present. Shipped as a plugin (Claude Code) and as a standalone skill (Desktop/Code).

**Visualiser** (`viz/`). A human view of the graph. A snapshot builder produces a self-contained interactive HTML page from a graph dump; a live local viewer that reads the vault directly is planned.

## Why Markdown as the source of truth

A database would be faster to query but it would lock the memory inside one tool. Markdown files in a folder mean you can read, edit, grep, sync, version, or delete your memory with anything, and Obsidian becomes an optional lens rather than a dependency. The graph is rebuilt from the files on demand, so it can never drift from them.

## Key decisions

- **Files canonical, graph derived.** No database is the source of truth. `vault_reindex` rebuilds the index from disk at any time.
- **The engine owns timestamps.** `created` and `updated` are never hand-written, so they stay honest.
- **Typed edges are just frontmatter.** Any field whose value is a list of wikilinks is an edge whose type is the field name. No separate schema to maintain.
- **Node, not Python.** Claude Desktop bundles Node, so a Node engine is a genuine zero-prerequisite install. (Python would need the user to have Python, or a bundled interpreter.)
- **Search excludes archived by default** and returns references, not bodies, to keep retrieval cheap as the store grows.
- **Watcher is opt-in.** The index re-reads changed files by mtime on each call, so correctness does not depend on a file watcher; the watcher is an optional latency optimisation.

## What works where

The skill runs on every surface. The engine's tools run wherever local MCP runs.

| | Claude Code | Claude Desktop | Cowork | claude.ai web |
|---|---|---|---|---|
| skill (the discipline) | yes | yes | yes | yes |
| engine tools (the store) | yes | yes | sandboxed, limited | no, remote only |

On claude.ai web there is no local file access, so the file-backed store does not run there. Reaching the store from web or Cowork would mean hosting the engine as a remote MCP endpoint, a separate and heavier setup that also moves the vault off the local machine.
