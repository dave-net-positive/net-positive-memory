# Graph

Store is already a graph: notes = nodes, `[[wikilinks]]` + `related` = edges, frontmatter = node properties. Engine graph tools answer "how connect" without reading many notes.

Use only if present. No graph tools -> fall back to the search ladder + follow wikilinks by hand.

## Tools
- `graph_neighbours(note, depth)`: notes within `depth`, edge direction + each neighbour's `summary`. Expand context around one note cheap.
- `graph_path(a, b)`: how two notes connect, a short link chain not full text.
- `graph_subgraph(seed_or_tag, depth)`: minimal connected set around a seed/tag. "Everything touching X".
- `graph_backlinks(note)`: who points here. Use before archive/delete to find dangling edges.

## Discovery first, content second
A graph call returns refs + edges + `summary`. Enough to pick 1 to 3 notes to read. Query graph -> `vault_read` only those. Do not read a note just to find its links when a graph call returns them far cheaper.

## On write
Declaring `related` = what makes future graph queries work. A note with no edges = an island the graph cannot find.
