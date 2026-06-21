---
name: net-positive-memory
description: Persistent memory for Claude backed by plain markdown files the user owns. Use whenever the user refers to past work, asks Claude to remember, recall, or "where were we", starts or resumes a project, or makes a decision worth keeping. Governs when to write to memory and how to retrieve it cheaply without flooding context.
---

# Memory

Notes = source of truth. Read least. Write little, often. Keep tidy. Detail in `references/`; read only the one for the op in hand, not all.

Tool names = net-positive-memory defaults. Other server: map by function (read, list, write, append, patch, delete, search, tag, graph).

## Orient (new session)
1. `vault_read` `INDEX.md`. Active projects, entities, pointers.
2. `vault_read` newest note in `sessions/`. Recent context.

Stop. No more until a task needs it.

## Retrieve cheapest-first
Climb. Stop at first rung that answers. Never dump store. Detail: `references/search.md`.
1. `tag_list`. See what exists.
2. `vault_search` with `where` (frontmatter filter, e.g. `status != archived`). Returns refs + `summary`, no bodies.
3. `vault_search` text. When `where` misses.
4. Graph tools if present (`graph_*`). Find connections, read only what they point at. See `references/graph.md`.
5. `vault_read` the 1 to 3 confirmed notes. Bodies enter context only here.

## Write (when worth keeping)
Record: decisions + reason, conventions, architecture, milestones, rejected approaches, stable preferences. Skip ephemeral.
- New atomic fact/entity/concept: `vault_write`, one idea per note. See `references/write.md`.
- Running log/session: `vault_append`. See `references/append.md`.
- Change part of existing note: `vault_patch`, not full rewrite. See `references/patch.md`.

Engine bumps `updated` and sets `created`. If your server does not, set them yourself. After a new project/decision/entity: add one line to `INDEX.md`.

## Tidy
Archive, not delete. Set `status: archived`, keep history. Genuine mistakes only: `vault_delete`. See `references/delete.md`.

## Voice
Notes terse + factual: frontmatter + short lines, not prose. `summary` = one sentence. Schema + voice: `references/schema.md`, `references/voice.md`. Chat with the user stays normal prose; only stored notes are terse.
