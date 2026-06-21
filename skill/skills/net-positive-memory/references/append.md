# Append

`vault_append` = add to end of an existing note, no rewrite. Cheapest progress record.

## Use for
- Session notes: a dated note in `sessions/` that grows through the session.
- Running logs on a project/entity: a new bullet under an existing heading.

## How
- Short lines, not paragraphs. Session entry = "did X, decided Y, next Z", not a narrative.
- One session note per day: `sessions/YYYY-MM-DD.md`. `vault_write` at start, `vault_append` through the day.

## Session shape
```
---
type: session
status: active
tags: [session]
created: 2026-06-21
updated: 2026-06-21
summary: One line on what this session was about.
related: ["[[project-x]]"]
---

# 2026-06-21

Goal: ...
Done:
- ...
Next: ...
```

## After
A new project/decision/entity from the session = its own note (see `write.md`), not just a log line.
