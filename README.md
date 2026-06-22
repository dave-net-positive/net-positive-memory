# Net Positive Memory

Persistent memory for Claude, kept as plain Markdown files you own.

Net Positive Memory gives Claude a memory that survives between chats and stays entirely on your machine. Every memory is an ordinary Markdown note with a one-line summary and a few tags; links between notes form a knowledge graph Claude can walk. Because the notes are just files in a folder you pick, you can read, edit, sync, version, or delete them with any tool, and Obsidian is an optional lens rather than a dependency. Claude searches and reads only the few notes it needs rather than loading everything, so memory stays cheap as it grows.

The headline feature is the install: it ships as a `.mcpb` Desktop Extension, so for an end user it is a double-click and a folder picker, with no Node, Python, npm, or config files to deal with.

## The pieces

- **`engine/`** - the Markdown store and its 13 tools, served over MCP and packaged as a `.mcpb` Desktop Extension. Written in Node so it runs on the runtime Claude Desktop already ships.
- **`skill/`** - the discipline layer: when to record something, how to retrieve it cheaply, how to keep it tidy. Optional; the engine carries a condensed version of it on its own.
- **`viz/`** - a frontmatter-aware graph visualiser, a nicer lens on the memory than Obsidian's graph.

## Quick start

1. Get `net-positive-memory.mcpb` from [Releases](../../releases), or build it (`cd engine && npm install && npm run build && npm run pack`).
2. In Claude Desktop: **Settings > Extensions > Advanced settings > Install Extension...**, choose the file, and pick a folder for your notes.
3. That is it. Ask Claude to remember something, or to search what it knows.

Full steps, including pointing at an existing Obsidian vault, are in [`docs/install.md`](docs/install.md).

## How it works

Plain Markdown files are the source of truth; the link graph is derived from them and rebuilt on demand, so it can never drift. The engine owns the `created`/`updated` timestamps and enforces a small frontmatter contract (`type`, `status`, `summary`) on every write, so the store stays consistent no matter what edits it. See [`docs/architecture.md`](docs/architecture.md) for the design and the decisions behind it.

<img width="765" height="680" alt="image" src="https://github.com/user-attachments/assets/b76bb130-636e-4847-abe7-a45fafdbe05d" />


## Documentation

- [`docs/install.md`](docs/install.md) - installing the engine and the skill
- [`docs/data-model.md`](docs/data-model.md) - the note and link contract
- [`docs/tools.md`](docs/tools.md) - the 13 tools
- [`docs/architecture.md`](docs/architecture.md) - design and decisions
- [`docs/engine-spec.md`](docs/engine-spec.md) - the original engine specification

## Status

Engine and skill are built and tested (store parity suite plus an end-to-end MCP check). The `.mcpb` installs and runs on Claude Desktop. A live local graph viewer is planned; the snapshot visualiser exists today.

## Licence

MIT. Built by [Net Positive](https://net-positive.uk).
