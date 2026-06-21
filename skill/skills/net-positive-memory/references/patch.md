# Patch

`vault_patch` = change one part of a note in place: a heading's section, or a frontmatter key. Not a full rewrite.

## Use for
- Update a fact in an entity note (server role changed, project -> `parked`).
- Edit one section, leave the rest.
- Change a frontmatter value (`status`, `summary`).

## Why patch not rewrite
Rewrite = read whole note, regenerate, risk drift in untouched parts. Patch = touch only the target, fewer tokens, rest exact.

## How
- Target by heading or frontmatter key.
- Smallest correct change. Replacing most of the note -> reconsider; maybe split into atomic notes.

## After
If the change alters connections, update `related` + the matching `INDEX.md` line.
