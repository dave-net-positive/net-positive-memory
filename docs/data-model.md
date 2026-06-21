# Data model

The notes are the source of truth. The graph is a derived, rebuildable index over them. Everything here is enforced by the engine on write, so the store stays consistent no matter which tool or editor touches it.

## A note

A note is a Markdown file with a YAML frontmatter block and a body.

```markdown
---
type: project
status: active
tags: [memory, mcp]
created: 2026-06-21
updated: 2026-06-21
summary: One sentence describing the note.
related: ["[[bifrost]]", "[[jotunheim]]"]
---

# Heading

Body text, which may contain [[wikilinks]] to other notes.
```

## Frontmatter

| Field | Required | Notes |
|---|---|---|
| `type` | yes | One of: `project`, `entity`, `decision`, `session`, `concept`, `reference`. |
| `status` | yes | One of: `active`, `parked`, `archived`. |
| `summary` | yes | A single sentence. Returned by search so the model rarely needs the body. |
| `created` | set by engine | `YYYY-MM-DD`. Written on creation; never set by hand. |
| `updated` | set by engine | `YYYY-MM-DD`. Bumped on every write. |
| `tags` | optional | A flat list of lowercase, hyphenated tags, no `#`. |
| `related` | optional | A list of `[[wikilinks]]`; the generic typed edge. |
| `aliases` | optional | Alternative names this note resolves under. |

Writes missing any of `type`, `status`, or `summary`, or using a value outside the enums, are rejected. Custom frontmatter fields are allowed and are searchable; only fields whose value is a list of wikilinks affect the graph.

## Links and the graph

- A `[[wikilink]]` resolves to a note by its filename stem (case-insensitive) or by an alias. A path-style link such as `[[folder/note]]` resolves by its last segment.
- Any frontmatter field whose value is a list of wikilinks is a **typed edge**, and the edge type is the field name. `related` is the generic case; you can invent others (for example `depends_on: ["[[x]]"]`).
- A `[[wikilink]]` in the body is an edge of type `mention`.
- A link to a name that has no note becomes a **missing node**, surfaced in graph results so dangling references are visible rather than silent.

## Folder convention

Not enforced, but assumed by the companion skill's orientation step:

```
INDEX.md            root hub: active projects, key entities, pointers
entities/           people, systems, places
projects/           ongoing work
decisions/          decisions and their reasons
sessions/           dated working logs
```

## Search

`vault_search` filters on frontmatter with operators `=`, `!=`, `in`, `contains`, `<`, `<=`, `>`, `>=`, plus an optional free-text match over summary, body, and path. Archived notes are excluded unless asked for. Results are references (path, type, status, summary, tags, updated), not bodies, so retrieval stays cheap.
