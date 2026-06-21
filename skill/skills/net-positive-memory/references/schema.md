# Schema

Shared vocabulary. Keep frontmatter small + consistent so structured search stays cheap.

## Core frontmatter
- `type` (required): `project` | `entity` | `decision` | `session` | `concept` | `reference`
- `status` (required): `active` | `parked` | `archived`
- `created` (required, `YYYY-MM-DD`): engine sets if absent
- `updated` (required, `YYYY-MM-DD`): engine bumps on change
- `summary` (required, one sentence): search returns this; make it carry the note
- `tags` (optional, list): lower case, hyphenated, no `#`
- `related` (optional, list of `"[[wikilink]]"`): edges
- `aliases` (optional, list): extra wikilink targets for this note

Missing `type` / `status` / `summary` on write = rejected. Note without them = invisible to cheap search.

Example:
```
---
type: entity
status: active
tags: [infra, server]
created: 2026-06-21
updated: 2026-06-21
summary: Always-on VPS. Hosts the agent runtime.
related: ["[[project-x]]", "[[memory-backend]]"]
---
```

## Custom fields
Any other key allowed. Stored, round-tripped, searchable via `where`. Ignored by graph unless value = list of `[[wikilinks]]`, then = typed edge, type = key name (e.g. `hosts: ["[[runtime]]"]`).

## Edges (graph)
Directed, from note outward. Sources:
- `related` list -> type `related`
- inline `[[wikilink]]` in body -> type `mention`
- frontmatter list-of-wikilinks -> type = key name

## Wikilink resolution
`[[Target]]` -> note whose filename stem = `Target` (case-insensitive) or whose `aliases` has `Target`. `[[Target|Display]]`: `Display` ignored. Name-based, not path-based; keep stems unique. Unresolved = dangling edge, surfaced by graph.

## Folders
`INDEX.md` (root hub); `entities/`, `projects/`, `decisions/`, `sessions/`; optional `concepts/`, `reference/`. Files = slugs (lower, hyphens, no spaces). Wikilink = filename stem.

## INDEX.md
Cheapest entry point, read first every session. Keep short: few bullets per section, each = wikilink + half-line. Add a line on a new project/decision/entity. Do not let it become a second copy of the store.
