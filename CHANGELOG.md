# Changelog

## 0.1.1 - 2026-06-21
- Resolve path-style wikilinks (`[[folder/note]]`) by their last segment, so subfolder links no longer become phantom nodes.
- Broaden the delete-time backlink scan to match path-style links too.

## 0.1.0 - 2026-06-21
- First build. Node engine ported from the Python reference, packaged as a `.mcpb` Desktop Extension.
- 13 tools: read, list, write, append, patch, delete, search, tag list, and graph neighbours/path/subgraph/backlinks, plus reindex.
- Governance skill (standalone and plugin forms).
- Snapshot graph visualiser.
