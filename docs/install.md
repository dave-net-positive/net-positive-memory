# Install

Two pieces: the **engine** (the tools, as a `.mcpb` Desktop Extension) and the optional **skill** (the discipline). Install the engine first.

## Engine, on Claude Desktop

1. Get `net-positive-memory.mcpb` (from the repo Releases page, or build it: see [`../engine/README.md`](../engine/README.md)).
2. In Claude Desktop, open **Settings > Extensions**, then **Advanced settings > Install Extension...** and select the file. (You can also drag the `.mcpb` onto the Extensions page.)
3. When prompted, **pick a folder** for your memory. A new or empty folder is best; the engine sets it up on first use. A folder inside a synced drive (iCloud, OneDrive, Dropbox) keeps your memory on every device.
4. Done. No terminal, no Node, no Python.

Double-clicking the file also works if Claude Desktop has registered the `.mcpb` file type. If your OS asks which application to open it with, the file association is not set, so use the in-app **Install Extension...** route above. Note that Claude Desktop is macOS and Windows only; there is no Linux build, so on Linux use Claude Code or a manual MCP config instead.

### Pointing at an existing vault

You can select an existing Obsidian vault rather than a fresh folder. The engine creates the folder only if it is missing and never restructures or deletes anything; it just indexes the Markdown already there. Two things to weigh: the server can read and write everything under that path, so choose a folder you are happy for the model to see; and if you already run another memory server over the same files, you will have duplicate tools, so retire the old one.

## Engine, on Claude Code

Claude Code can install a `.mcpb` directly, or you can add a server entry pointing `node` at the built `dist/server/index.cjs` with `MEMORY_PATH` set to your folder.

## Skill (optional)

The engine already carries the core discipline in its server instructions, so the skill is an enhancement, not a requirement.

- **Standalone skill**: add `net-positive-memory.skill` (or the `skill/skills/net-positive-memory` folder) as a skill in Desktop or Code.
- **Plugin**: install `skill/` as a plugin in Claude Code.

## Verify

Ask Claude to list your memory (`vault_list`) or search it (`vault_search`). If the tools respond, you are set. A quick self-test is to have Claude write a throwaway note, read it back, and delete it.
