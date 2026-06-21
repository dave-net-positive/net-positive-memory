# Net Positive Memory: visualiser

A human-friendly view of the memory graph: notes coloured by type, sized by how connected they are, with typed links, a searchable side panel, and click-through navigation. A nicer lens than Obsidian's graph because it is frontmatter-aware.

## Snapshot (this folder)

`build_graph.py` turns a graph snapshot into a single self-contained HTML file you can open in any browser. The snapshot is whatever the engine's tools return for your vault at a point in time, saved as `data.json`.

```bash
# data.json shape: { "nodes": [ {path,type,status,summary,tags,updated}, ... ],
#                    "edges": [ {from,to,type}, ... ] }
python3 build_graph.py        # writes net-positive-memory-graph.html
```

To regenerate the snapshot, ask Claude (with the engine connected) to dump the
graph, for example: pull every note with `vault_search` and the edges with
`graph_subgraph` seeded at your index note, then drop the result into `data.json`.
`sample-data.json` is an example shape.

Features: force-directed layout, colour by note type, dashed lines for inline
mentions vs solid for typed links, full-text filter, per-type toggles, a "missing"
toggle that surfaces links pointing at notes that do not exist, and a details panel
listing each note's summary, tags, and in/out links.

## Live viewer (planned)

The snapshot is a point-in-time view. A small local web app that imports the same
`engine/src/store.js`, reads the vault directly, and serves a localhost page that
updates as notes change is the always-current option. It cannot be a browser
artifact because it needs filesystem access, so it ships as a companion you run
locally. Tracked as future work.
