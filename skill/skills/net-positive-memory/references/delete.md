# Delete

Default = do not delete. Memory cheap, history useful. Prefer archive.

## Archive instead
No longer current but once true -> `vault_patch` `status: archived`, leave in place. Archived excluded from the default ladder (rung 2 filters `status != archived`), still available if asked. Active store stays small, record kept.

## When delete is right
`vault_delete` = genuine mistakes only: created in error, a duplicate, test content, or the user explicitly says remove.

## Before delete
- Check not linked elsewhere. A deleted note still linked = dangling edges. Patch those `related` first, or archive instead.
- User says "forget" something real (not fix a mistake) -> archive is usually the safer reading. Delete only on an explicit, unambiguous instruction.

## After
Remove its `INDEX.md` line + any `related` references to it.
