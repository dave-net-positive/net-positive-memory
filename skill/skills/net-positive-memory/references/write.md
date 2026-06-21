# Write

`vault_write` = new note. New atomic fact/entity/decision/concept. One idea per note.

## New note vs append
New note if: stable identity worth linking to (entity/project/decision), or a concept findable on its own terms. Running update to an existing thing -> append or patch.

## Shape
Frontmatter (see `schema.md`) + short body. Facts + links only:
```
---
type: decision
status: active
tags: [architecture]
created: 2026-06-21
updated: 2026-06-21
summary: Markdown stays canonical; the graph is a derived, rebuildable index.
related: ["[[memory-engine]]"]
---

Files = source of truth. Graph projected from frontmatter + wikilinks, rebuildable
anytime. Reason: notes stay human-readable + portable; the DB never becomes the
thing you cannot read.
```

## After write
- Add a `[[wikilink]]` from any existing note that should point here; list those in `related`. Edges make later retrieval cheap.
- New project/decision/entity -> add one line to `INDEX.md`.

## Atomic
A note doing two things -> split. Two linked notes are cheaper to retrieve than one big note you must read whole to find one fact.
