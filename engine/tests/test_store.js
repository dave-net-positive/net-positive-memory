// Parity tests for the Node store. Run: node tests/test_store.js
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { Store, parseNote, dumpNote, StoreError } from "../src/store.js";

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; } catch (e) { fail++; console.error("FAIL:", name, "\n  ", e.message); }
}
function tmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "npmem-test-"));
}
const today = (() => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

// ---- frontmatter round trip ----
check("parse/dump round trip", () => {
  const text = dumpNote({ type: "project", status: "active", tags: ["infra", "vps"], created: "2026-01-01", updated: "2026-06-21", summary: "Always-on VPS.", related: ["[[jotunheim]]", "[[bifrost]]"] }, "# Body\n\nSome text.");
  const { fm, body } = parseNote(text);
  assert.equal(fm.type, "project");
  assert.deepEqual(fm.tags, ["infra", "vps"]);
  assert.deepEqual(fm.related, ["[[jotunheim]]", "[[bifrost]]"]);
  assert.equal(fm.created, "2026-01-01");
  assert.equal(body.trim(), "# Body\n\nSome text.");
});

check("dump emits flow lists, unquoted dates, quoted wikilinks", () => {
  const text = dumpNote({ type: "entity", status: "active", tags: ["a", "b"], created: "2026-01-01", updated: "2026-01-02", summary: "x", related: ["[[foo]]"] }, "body");
  assert.ok(text.includes("tags: [a, b]"), "flow tags");
  assert.ok(text.includes("created: 2026-01-01"), "unquoted date");
  assert.ok(/related: \["\[\[foo\]\]"\]/.test(text), "quoted wikilink: " + text);
});

check("frontmatter key order is canonical", () => {
  const text = dumpNote({ summary: "s", status: "active", type: "concept" }, "b");
  const idxType = text.indexOf("type:"), idxStatus = text.indexOf("status:"), idxSummary = text.indexOf("summary:");
  assert.ok(idxType < idxStatus && idxStatus < idxSummary, "order");
});

check("custom frontmatter field preserved and placed after core", () => {
  const text = dumpNote({ type: "reference", status: "active", summary: "s", vendor: "Acme" }, "b");
  assert.ok(text.includes("vendor: Acme"));
  const { fm } = parseNote(text);
  assert.equal(fm.vendor, "Acme");
});

check("summary needing quotes is quoted", () => {
  const text = dumpNote({ type: "concept", status: "active", summary: "key: value pair" }, "b");
  assert.ok(text.includes('summary: "key: value pair"'), text);
  const { fm } = parseNote(text);
  assert.equal(fm.summary, "key: value pair");
});

// ---- validation ----
check("write rejects missing required fields", () => {
  const s = new Store(tmpRoot());
  assert.throws(() => s.write("x", { type: "project", status: "active" }, "b"), /missing required/);
});
check("write rejects bad enum", () => {
  const s = new Store(tmpRoot());
  assert.throws(() => s.write("x", { type: "nope", status: "active", summary: "s" }, "b"), /invalid type/);
  assert.throws(() => s.write("y", { type: "project", status: "nope", summary: "s" }, "b"), /invalid status/);
});

// ---- CRUD ----
check("write sets created/updated and read returns them", () => {
  const s = new Store(tmpRoot());
  s.write("entities/bifrost", { type: "entity", status: "active", summary: "VPS" }, "# Bifrost");
  const r = s.read("entities/bifrost");
  assert.equal(r.frontmatter.created, today);
  assert.equal(r.frontmatter.updated, today);
  assert.equal(r.path, "entities/bifrost.md");
  assert.ok(r.body.includes("# Bifrost"));
});

check("write refuses to clobber without overwrite", () => {
  const s = new Store(tmpRoot());
  s.write("a", { type: "project", status: "active", summary: "s" }, "b");
  assert.throws(() => s.write("a", { type: "project", status: "active", summary: "s2" }, "b2"), /exists/);
  s.write("a", { type: "project", status: "active", summary: "s2" }, "b2", true);
  assert.equal(s.read("a").frontmatter.summary, "s2");
});

check("path escape is blocked", () => {
  const s = new Store(tmpRoot());
  assert.throws(() => s.write("../evil", { type: "project", status: "active", summary: "s" }, "b"), /escapes/);
});

check("list returns dirs first with trailing slash", () => {
  const root = tmpRoot();
  const s = new Store(root);
  s.write("projects/p1", { type: "project", status: "active", summary: "s" }, "b");
  s.write("zzz", { type: "concept", status: "active", summary: "s" }, "b");
  const entries = s.list("");
  assert.ok(entries.includes("projects/"));
  assert.ok(entries.includes("zzz.md"));
  assert.ok(entries.indexOf("projects/") < entries.indexOf("zzz.md"));
});

check("append adds to body and bumps updated", () => {
  const s = new Store(tmpRoot());
  s.write("n", { type: "session", status: "active", summary: "s", created: "2020-01-01", updated: "2020-01-01" }, "line1", true);
  s.append("n", "line2");
  const r = s.read("n");
  assert.ok(r.body.includes("line1"));
  assert.ok(r.body.includes("line2"));
  assert.equal(r.frontmatter.updated, today);
});

check("append create=true makes the note", () => {
  const s = new Store(tmpRoot());
  s.append("fresh", "hello", true, { type: "concept", status: "active", summary: "s" });
  assert.ok(s.read("fresh").body.includes("hello"));
});

check("patch heading replaces only that section", () => {
  const s = new Store(tmpRoot());
  s.write("doc", { type: "reference", status: "active", summary: "s" }, "# A\nold a\n\n# B\nkeep b");
  s.patch("doc", { heading: "A" }, "new a");
  const body = s.read("doc").body;
  assert.ok(body.includes("new a"));
  assert.ok(!body.includes("old a"));
  assert.ok(body.includes("keep b"));
});

check("patch frontmatter sets a field", () => {
  const s = new Store(tmpRoot());
  s.write("doc", { type: "reference", status: "active", summary: "s" }, "b");
  s.patch("doc", { frontmatter: "status" }, "parked");
  assert.equal(s.read("doc").frontmatter.status, "parked");
});

check("delete confirm=false reports backlinks and keeps file", () => {
  const s = new Store(tmpRoot());
  s.write("target", { type: "entity", status: "active", summary: "s" }, "b");
  s.write("linker", { type: "project", status: "active", summary: "s", related: ["[[target]]"] }, "see [[target]]");
  const r = s.delete("target", false);
  assert.equal(r.deleted, false);
  assert.ok(r.backlinks.includes("linker.md"));
  assert.ok(fs.existsSync(path.join(s.root, "target.md")));
});

check("delete confirm=true removes file", () => {
  const s = new Store(tmpRoot());
  s.write("gone", { type: "entity", status: "active", summary: "s" }, "b");
  const r = s.delete("gone");
  assert.equal(r.deleted, true);
  assert.ok(!fs.existsSync(path.join(s.root, "gone.md")));
});

// ---- search ----
function seedSearch() {
  // Seed as raw files so 'updated' is deterministic (write() always bumps it to today).
  const root = tmpRoot();
  const s = new Store(root);
  const wf = (name, fm, body) => fs.writeFileSync(path.join(root, name + ".md"), dumpNote(fm, body));
  wf("a", { type: "project", status: "active", summary: "alpha vps", tags: ["infra"], created: "2026-01-01", updated: "2026-06-01" }, "alpha body");
  wf("b", { type: "project", status: "parked", summary: "beta", tags: ["infra", "draft"], created: "2026-01-01", updated: "2026-06-10" }, "beta body");
  wf("c", { type: "entity", status: "archived", summary: "gamma", tags: ["infra"], created: "2026-01-01", updated: "2026-06-20" }, "gamma body");
  return s;
}
check("search hides archived by default", () => {
  const s = seedSearch();
  const r = s.search(null, null, false, 20);
  const paths = r.results.map((x) => x.path);
  assert.ok(!paths.includes("c.md"));
  assert.ok(paths.includes("a.md") && paths.includes("b.md"));
});
check("search include_archived shows archived", () => {
  const s = seedSearch();
  const paths = s.search(null, null, true, 20).results.map((x) => x.path);
  assert.ok(paths.includes("c.md"));
});
check("search where equality and op forms", () => {
  const s = seedSearch();
  assert.deepEqual(s.search(null, { type: "entity" }, true, 20).results.map((x) => x.path), ["c.md"]);
  const parked = s.search(null, { status: { "!=": "active" } }, true, 20).results.map((x) => x.path).sort();
  assert.deepEqual(parked, ["b.md", "c.md"]);
});
check("search where contains on tags", () => {
  const s = seedSearch();
  const r = s.search(null, { tags: { contains: "draft" } }, true, 20).results.map((x) => x.path);
  assert.deepEqual(r, ["b.md"]);
});
check("search where in", () => {
  const s = seedSearch();
  const r = s.search(null, { type: { in: ["entity", "project"] } }, true, 20).results.map((x) => x.path).sort();
  assert.deepEqual(r, ["a.md", "b.md", "c.md"]);
});
check("search where date range", () => {
  const s = seedSearch();
  const r = s.search(null, { updated: { ">": "2026-06-05" } }, true, 20).results.map((x) => x.path).sort();
  assert.deepEqual(r, ["b.md", "c.md"]);
});
check("search text query", () => {
  const s = seedSearch();
  const r = s.search("alpha", null, true, 20).results.map((x) => x.path);
  assert.deepEqual(r, ["a.md"]);
});
check("search sorts by updated desc", () => {
  const s = seedSearch();
  const r = s.search(null, null, true, 20).results.map((x) => x.path);
  assert.deepEqual(r, ["c.md", "b.md", "a.md"]);
});
check("search limit caps results", () => {
  const s = seedSearch();
  assert.equal(s.search(null, null, true, 1).results.length, 1);
  assert.equal(s.search(null, null, true, 1).count, 3);
});

// ---- tags ----
check("tag_list counts, excludes archived by default", () => {
  const s = seedSearch();
  const tags = Object.fromEntries(s.tagList(false).tags.map((t) => [t.tag, t.count]));
  assert.equal(tags.infra, 2);
  assert.equal(tags.draft, 1);
  const all = Object.fromEntries(s.tagList(true).tags.map((t) => [t.tag, t.count]));
  assert.equal(all.infra, 3);
});

// ---- graph ----
function seedGraph() {
  const s = new Store(tmpRoot());
  s.write("openthor", { type: "project", status: "active", summary: "agent", related: ["[[bifrost]]", "[[ollama]]"] }, "runs on [[bifrost]]", true);
  s.write("bifrost", { type: "entity", status: "active", summary: "vps", aliases: ["the vps"] }, "hosts things", true);
  s.write("ollama", { type: "entity", status: "active", summary: "llm", related: ["[[jotunheim]]"] }, "on [[jotunheim]]", true);
  s.write("jotunheim", { type: "entity", status: "active", summary: "gpu box" }, "rx7900", true);
  return s;
}
check("graph_neighbours depth 1", () => {
  const s = seedGraph();
  const n = s.graphNeighbours("openthor", 1).nodes.map((x) => x.path || x.name).sort();
  assert.ok(n.includes("openthor.md") && n.includes("bifrost.md") && n.includes("ollama.md"));
  assert.ok(!n.includes("jotunheim.md"));
});
check("graph_neighbours depth 2 reaches jotunheim", () => {
  const s = seedGraph();
  const n = s.graphNeighbours("openthor", 2).nodes.map((x) => x.path || x.name);
  assert.ok(n.includes("jotunheim.md"));
});
check("graph_neighbours edge_types filter", () => {
  const s = seedGraph();
  const n = s.graphNeighbours("openthor", 1, ["related"]).nodes.map((x) => x.path);
  assert.ok(n.includes("bifrost.md"));
});
check("graph alias resolves", () => {
  const s = seedGraph();
  const n = s.graphNeighbours("the vps", 1).nodes.map((x) => x.path);
  assert.ok(n.includes("bifrost.md"));
});
check("graph_path finds chain", () => {
  const s = seedGraph();
  const r = s.graphPath("openthor", "jotunheim");
  const p = r.path.map((x) => x.path);
  assert.equal(p[0], "openthor.md");
  assert.equal(p[p.length - 1], "jotunheim.md");
  assert.ok(p.length >= 3);
});
check("graph_backlinks lists linkers with type", () => {
  const s = seedGraph();
  const bl = s.graphBacklinks("bifrost").backlinks;
  const froms = bl.map((x) => x.from.path);
  assert.ok(froms.includes("openthor.md"));
  assert.ok(bl.some((x) => x.type === "related" || x.type === "mention"));
});
check("graph missing target becomes a missing node", () => {
  const s = new Store(tmpRoot());
  s.write("solo", { type: "project", status: "active", summary: "s", related: ["[[ghost]]"] }, "b");
  const n = s.graphNeighbours("solo", 1).nodes;
  assert.ok(n.some((x) => x.missing && x.name === "ghost"));
});
check("graph_subgraph by tag", () => {
  const s = seedGraph();
  s.patch("openthor", { frontmatter: "tags" }, ["cluster"]);
  s.patch("bifrost", { frontmatter: "tags" }, ["cluster"]);
  const r = s.graphSubgraph(null, "cluster", 1).nodes.map((x) => x.path);
  assert.ok(r.includes("openthor.md") && r.includes("bifrost.md"));
});
check("graph resolves path-style wikilink by basename", () => {
  const s = new Store(tmpRoot());
  s.write("projects/sub/target-note", { type: "entity", status: "active", summary: "t" }, "b");
  s.write("linker", { type: "project", status: "active", summary: "s" }, "see [[projects/sub/target-note]]");
  const n = s.graphNeighbours("linker", 1).nodes.map((x) => x.path);
  assert.ok(n.includes("projects/sub/target-note.md"), "path-style link resolved: " + JSON.stringify(n));
});
check("delete backlink scan matches path-style links", () => {
  const s = new Store(tmpRoot());
  s.write("a/b/note", { type: "entity", status: "active", summary: "t" }, "b");
  s.write("ref", { type: "project", status: "active", summary: "s" }, "[[a/b/note]]");
  const r = s.delete("a/b/note", false);
  assert.ok(r.backlinks.includes("ref.md"), "path-style backlink found");
});
check("reindex reports counts", () => {
  const s = seedGraph();
  const r = s.reindex();
  assert.equal(r.notes, 4);
  assert.ok(r.edges >= 3);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
