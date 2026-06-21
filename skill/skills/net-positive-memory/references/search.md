# Search and retrieve

Biggest token saver = read less. Discover via cheap structured calls; read bodies only after.

## Ladder
Order. Stop at first rung that answers.
1. `tag_list`: tags + counts. Tiny. Learn the shape before guessing.
2. `vault_search` `where`: frontmatter filter, e.g. `type = decision`, `status != archived`. Returns refs + `summary`, no bodies. Most questions die here.
3. `vault_search` text: plain match when `where` misses (phrase in a body, not frontmatter).
4. Graph: "how connect" / "what touches X" -> `graph_*` (see `graph.md`). Minimal connected set, not many reads.
5. `vault_read`: now, only 1 to 3 confirmed notes. `format: metadata` for frontmatter without body.

## Just-in-time, not just-in-case
No pre-loading "in case". Each rung returns enough to pick the next. One-decision question = `tag_list` or one `where` + one `vault_read`. Not a folder sweep.

## Empty / conflicting
Reformulate once: different terms or broader filter. Still empty -> say so, proceed with what is in hand. Never invent a missing note.

## Stop
Done when every part of the answer is grounded in a note actually read. Reading a 4th/5th "to be safe" = filter too loose, or answer already in hand.
