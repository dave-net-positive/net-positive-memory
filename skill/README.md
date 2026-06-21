# Net Positive Memory (skill)

The discipline layer for Claude's markdown memory. This skill teaches Claude *when* to record something worth keeping and *how* to retrieve it cheaply, climbing from cheap lookups to full reads so context never floods.

It is the companion to the **Net Positive Memory engine**, which ships separately as a `.mcpb` Desktop Extension and provides the actual tools (`vault_read`, `vault_write`, `vault_search`, the `graph_*` traversal, and so on) over a folder of markdown notes you own.

## The two pieces

| Piece | What it is | How to install |
|---|---|---|
| Engine (`.mcpb`) | The store and its 13 tools. Plain markdown in a folder you pick. | Claude Desktop > Settings > Extensions > Install Extension, then pick a folder. |
| This skill | The judgement: when to write, how to retrieve, how to keep it tidy. | Add as a skill (Desktop/Code), or install as a plugin (Code). |

The engine already carries a condensed version of this guidance in its server instructions, so it is useful on its own. Add this skill when you want the fuller discipline.

## What the skill does

- **Orient** at the start of a session: read `INDEX.md` and the latest session note, then stop.
- **Retrieve cheapest-first**: tags, then a frontmatter-filtered search, then text, then the graph, and only then read the one to three notes that matter. Never dump the whole store.
- **Write sparingly and durably**: decisions and why, conventions, architecture, milestones, rejected approaches. Append to logs, patch in place rather than rewriting.
- **Keep tidy**: archive rather than delete; keep notes terse and factual.

The lean `SKILL.md` loads first; per-operation detail in `references/` loads only when the matching operation is in hand.

## What works where

The skill runs on every surface. The engine's tools run wherever local MCP runs.

| | Claude Code | Claude Desktop | Cowork | claude.ai web |
|---|---|---|---|---|
| this skill (the discipline) | yes | yes | yes | yes |
| engine tools (the store) | yes | yes | sandboxed, limited | no, remote only |

On claude.ai web there is no local file access, so the file-backed store does not run there; the skill still sharpens how Claude uses its own native memory.

## Personalising

Keep personal conventions (a stricter note style, a naming scheme, a punctuation rule) in your own layer, a personal note or project instruction, not in this skill, so the skill stays generic and your style survives updates.

## Licence

MIT. Built by Net Positive, https://net-positive.uk
