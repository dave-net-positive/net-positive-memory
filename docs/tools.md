# Tools

Thirteen tools over the store. All return JSON. Errors come back as an MCP error result with a plain message rather than throwing.

## Notes

| Tool | Arguments | Does |
|---|---|---|
| `vault_read` | `path`, `format?` (`content`\|`metadata`) | Read one note. `content` returns frontmatter + body; `metadata` returns frontmatter, tags and file stat only. |
| `vault_list` | `path?` | List entries in a folder; directories end with `/`. Empty path lists the root. |
| `vault_write` | `path`, `frontmatter`, `body?`, `overwrite?` | Create a note (or replace with `overwrite=true`). Frontmatter must include `type`, `status`, `summary`; `created`/`updated` are set for you. |
| `vault_append` | `path`, `text`, `create?`, `frontmatter?` | Append to a note's body. `create=true` makes the note first (pass `frontmatter` for that case). |
| `vault_patch` | `path`, `target`, `content` | Replace one section in place. `target` is `{heading: "Name"}` for a body section or `{frontmatter: "key"}` for a field. |
| `vault_delete` | `path`, `confirm?` | Delete a note. `confirm=false` returns the note's backlinks without deleting, so you can see what would break first. |

## Search and tags

| Tool | Arguments | Does |
|---|---|---|
| `vault_search` | `query?`, `where?`, `include_archived?`, `limit?` | Find notes by frontmatter and text. `where` maps a field to a value or to `{op: value}` (ops: `=`, `!=`, `in`, `contains`, `<`, `<=`, `>`, `>=`). Archived hidden unless `include_archived=true`. Sorted by `updated` descending. |
| `tag_list` | `include_archived?` | Every tag in use with counts, most used first. |

## Graph

| Tool | Arguments | Does |
|---|---|---|
| `graph_neighbours` | `note`, `depth?`, `edge_types?` | Notes within `depth` hops. `edge_types` filters to specific link kinds, for example `["related"]`. |
| `graph_path` | `from`, `to`, `max_depth?`, `directed?` | Shortest link path between two notes. `directed=true` follows link direction only. |
| `graph_subgraph` | `seed?`, `tag?`, `depth?` | The connected cluster around a seed note and/or every note carrying a tag. |
| `graph_backlinks` | `note` | Notes that link to this note, with each link's edge type. |
| `vault_reindex` | none | Rebuild the in-memory index and graph from disk. Use after bulk external edits. |

## Retrieval, cheapest first

The intended pattern, which the companion skill encodes: `tag_list` or `vault_search` to find the few notes that matter, `vault_read` only those, and the `graph_*` tools when you need connections. Never read the whole store.
