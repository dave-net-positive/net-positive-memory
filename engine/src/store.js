// Core store logic for Net Positive Memory (Node port).
// File-direct markdown store. No MCP dependency, so it is unit-testable.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import YAML from "yaml";

export class StoreError extends Error {}

const FRONTMATTER_ORDER = ["type", "status", "tags", "created", "updated", "summary", "related", "aliases"];
const REQUIRED = ["type", "status", "summary"];
const TYPE_ENUM = new Set(["project", "entity", "decision", "session", "concept", "reference"]);
const STATUS_ENUM = new Set(["active", "parked", "archived"]);
const DATE_FIELDS = new Set(["created", "updated"]);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/;
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;
const WIKILINK_FULL = /^\[\[([^\]|]+)(?:\|[^\]]*)?\]\]$/;

function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function stemOf(rel) {
  const b = (rel || "").split(/[/\\]/).pop() || rel;
  return b.replace(/\.md$/i, "");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- frontmatter parse / emit ----

function normaliseFm(fm) {
  const out = {};
  for (const [k, v] of Object.entries(fm)) {
    out[k] = v instanceof Date ? v.toISOString().slice(0, 10) : v;
  }
  return out;
}

export function parseNote(text) {
  if (text.startsWith("---")) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
    if (m) {
      let fm;
      try {
        fm = YAML.parse(m[1]) || {};
      } catch (e) {
        throw new StoreError("invalid YAML frontmatter: " + e.message);
      }
      if (typeof fm !== "object" || Array.isArray(fm)) throw new StoreError("frontmatter is not a mapping");
      const body = text.slice(m[0].length).replace(/^\n+/, "");
      return { fm: normaliseFm(fm), body };
    }
  }
  return { fm: {}, body: text };
}

function needsQuote(s) {
  if (s === "") return true;
  if (/^\s|\s$/.test(s)) return true;
  if (/:\s/.test(s) || /\s#/.test(s)) return true;
  if (/^[!&*\[\]{}>|%@`"'#,?:\-]/.test(s)) return true;
  if (/^(true|false|null|~)$/i.test(s)) return true;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return true;
  return false;
}

function emitScalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v);
  return needsQuote(s) ? JSON.stringify(s) : s;
}

function emitField(key, val) {
  if (DATE_FIELDS.has(key) && typeof val === "string" && DATE_RE.test(val)) return `${key}: ${val}`;
  if (Array.isArray(val)) return `${key}: [${val.map(emitScalar).join(", ")}]`;
  if (val !== null && typeof val === "object") {
    return `${key}:\n` + YAML.stringify(val).replace(/\n$/, "").split("\n").map((l) => "  " + l).join("\n");
  }
  return `${key}: ${emitScalar(val)}`;
}

export function dumpNote(fm, body) {
  const ordered = [];
  for (const k of FRONTMATTER_ORDER) if (k in fm) ordered.push([k, fm[k]]);
  for (const k of Object.keys(fm)) if (!FRONTMATTER_ORDER.includes(k)) ordered.push([k, fm[k]]);
  const fmText = ordered.map(([k, v]) => emitField(k, v)).join("\n");
  const bodyClean = String(body || "").replace(/^\n+|\n+$/g, "");
  return `---\n${fmText}\n---\n\n${bodyClean}\n`;
}

function validate(fm) {
  const missing = REQUIRED.filter((f) => !fm[f]);
  if (missing.length) throw new StoreError("missing required frontmatter: " + missing.join(", "));
  if (!TYPE_ENUM.has(fm.type)) throw new StoreError(`invalid type '${fm.type}'. one of: ${[...TYPE_ENUM].sort().join(", ")}`);
  if (!STATUS_ENUM.has(fm.status)) throw new StoreError(`invalid status '${fm.status}'. one of: ${[...STATUS_ENUM].sort().join(", ")}`);
}

function atomicWrite(target, text) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = path.join(path.dirname(target), `.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmp, text, { encoding: "utf8" });
  fs.renameSync(tmp, target);
}

// ---- search / graph helpers ----

function ref(e) {
  const fm = e.fm;
  return { path: e.path, type: fm.type ?? null, status: fm.status ?? null, summary: fm.summary ?? null, tags: fm.tags || [], updated: fm.updated ?? null };
}

function textMatch(e, q) {
  q = q.toLowerCase();
  return [String(e.fm.summary || ""), e.body, e.path].join(" ").toLowerCase().includes(q);
}

function applyOp(op, val, t) {
  switch (op) {
    case "=": case "==": return val === t;
    case "!=": return val !== t;
    case "in": return Array.isArray(t) && t.includes(val);
    case "contains":
      if (Array.isArray(val)) return val.includes(t);
      if (typeof val === "string") return val.toLowerCase().includes(String(t).toLowerCase());
      return false;
    case "<": return val != null && val < t;
    case "<=": return val != null && val <= t;
    case ">": return val != null && val > t;
    case ">=": return val != null && val >= t;
    default: throw new StoreError(`unknown operator '${op}'`);
  }
}

function matchWhere(fm, where) {
  for (const [field, cond] of Object.entries(where)) {
    const val = fm[field];
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      for (const [op, t] of Object.entries(cond)) if (!applyOp(op, val, t)) return false;
    } else if (val !== cond) {
      return false;
    }
  }
  return true;
}

function isWikilinkList(v) {
  return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string" && WIKILINK_FULL.test(x.trim()));
}

function outEdges(fm, body) {
  const edges = [];
  for (const [k, v] of Object.entries(fm)) {
    if (k === "aliases") continue;
    if (isWikilinkList(v)) for (const item of v) {
      const m = String(item).trim().match(WIKILINK_FULL);
      if (m) edges.push([m[1].trim(), k]);
    }
  }
  const re = new RegExp(WIKILINK_RE.source, "g");
  let m;
  while ((m = re.exec(body || "")) !== null) edges.push([m[1].trim(), "mention"]);
  return edges;
}

function nodeOut(g, n) {
  const d = g.nodes.get(n);
  if (d.missing) return { path: null, name: d.name, missing: true };
  return { path: n, type: d.type, status: d.status, summary: d.summary, tags: d.tags || [], updated: d.updated };
}

function undirectedNeighbors(g, u) {
  const s = new Set();
  if (g.out.has(u)) for (const v of g.out.get(u).keys()) s.add(v);
  if (g.radj.has(u)) for (const v of g.radj.get(u)) s.add(v);
  return s;
}

function edgeTypesBetween(g, u, v) {
  const t = new Set();
  if (g.out.has(u) && g.out.get(u).has(v)) for (const x of g.out.get(u).get(v)) t.add(x);
  if (g.out.has(v) && g.out.get(v).has(u)) for (const x of g.out.get(v).get(u)) t.add(x);
  return t;
}

function ego(g, start, depth, edgeTypes) {
  const et = edgeTypes ? new Set(edgeTypes) : null;
  const visited = new Set([start]);
  let frontier = new Set([start]);
  for (let i = 0; i < depth; i++) {
    const next = new Set();
    for (const u of frontier) for (const v of undirectedNeighbors(g, u)) {
      if (et) {
        let ok = false;
        for (const x of edgeTypesBetween(g, u, v)) if (et.has(x)) { ok = true; break; }
        if (!ok) continue;
      }
      if (!visited.has(v)) next.add(v);
    }
    for (const v of next) visited.add(v);
    frontier = next;
    if (frontier.size === 0) break;
  }
  return visited;
}

function edgesAmong(g, nodes, edgeTypes) {
  const et = edgeTypes ? new Set(edgeTypes) : null;
  const members = new Set(nodes);
  const out = [];
  for (const [from, m] of g.out) if (members.has(from)) for (const [to, types] of m) if (members.has(to)) {
    if (et) {
      let ok = false;
      for (const x of types) if (et.has(x)) { ok = true; break; }
      if (!ok) continue;
    }
    out.push({ from, to, type: types[0] || null });
  }
  return out;
}

function bfsPath(g, a, b, directed) {
  if (a === b) return [a];
  const q = [a];
  const parent = new Map([[a, null]]);
  while (q.length) {
    const u = q.shift();
    const neigh = directed ? (g.out.has(u) ? [...g.out.get(u).keys()] : []) : [...undirectedNeighbors(g, u)];
    for (const v of neigh) {
      if (!parent.has(v)) {
        parent.set(v, u);
        if (v === b) {
          const p = [];
          let c = v;
          while (c !== null) { p.push(c); c = parent.get(c); }
          return p.reverse();
        }
        q.push(v);
      }
    }
  }
  return null;
}

function pathEdges(g, p) {
  const out = [];
  for (let i = 0; i < p.length - 1; i++) {
    const u = p[i], v = p[i + 1];
    let type = null, from = u, to = v;
    if (g.out.has(u) && g.out.get(u).has(v)) type = g.out.get(u).get(v)[0];
    else if (g.out.has(v) && g.out.get(v).has(u)) { type = g.out.get(v).get(u)[0]; from = v; to = u; }
    out.push({ from, to, type });
  }
  return out;
}

// ---- Store ----

export class Store {
  constructor(root) {
    const expanded = String(root).replace(/^~(?=$|[/\\])/, os.homedir());
    this.root = path.resolve(expanded);
    fs.mkdirSync(this.root, { recursive: true });
    this._cache = new Map();
    this._watching = false;
  }

  _resolve(rel) {
    rel = (rel || "").trim().replace(/^[/\\]+/, "");
    if (!rel) throw new StoreError("empty path");
    if (!rel.endsWith(".md")) rel = rel + ".md";
    const p = path.resolve(this.root, rel);
    const base = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (p !== this.root && !p.startsWith(base)) throw new StoreError("path escapes the memory folder");
    return p;
  }

  _rel(p) {
    return path.relative(this.root, p).split(path.sep).join("/");
  }

  _allMd() {
    const out = [];
    const walk = (d) => {
      let entries;
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const fp = path.join(d, e.name);
        if (e.isDirectory()) walk(fp);
        else if (e.name.endsWith(".md")) out.push(fp);
      }
    };
    if (fs.existsSync(this.root)) walk(this.root);
    return out;
  }

  read(rel, fmt = "content") {
    const p = this._resolve(rel);
    if (!fs.existsSync(p)) throw new StoreError(`note not found: ${this._rel(p)}`);
    const { fm, body } = parseNote(fs.readFileSync(p, "utf8"));
    if (fmt === "metadata") {
      const st = fs.statSync(p);
      return { path: this._rel(p), frontmatter: fm, tags: fm.tags || [], stat: { size: st.size, modified: new Date(st.mtimeMs).toISOString().slice(0, 19) } };
    }
    return { path: this._rel(p), frontmatter: fm, body };
  }

  list(dir = "") {
    dir = (dir || "").trim().replace(/^[/\\]+/, "");
    const baseDir = path.resolve(this.root, dir);
    const base = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (baseDir !== this.root && !baseDir.startsWith(base)) throw new StoreError("path escapes the memory folder");
    if (!fs.existsSync(baseDir)) throw new StoreError(`directory not found: ${dir}`);
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const out = entries.map((e) => (e.isDirectory() ? e.name + "/" : e.name));
    out.sort((a, b) => {
      const af = !a.endsWith("/"), bf = !b.endsWith("/");
      if (af !== bf) return af ? 1 : -1;
      return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;
    });
    return out;
  }

  write(rel, frontmatter, body = "", overwrite = false) {
    const p = this._resolve(rel);
    if (fs.existsSync(p) && !overwrite) throw new StoreError(`note exists: ${this._rel(p)}. pass overwrite=true to replace.`);
    const fm = { ...(frontmatter || {}) };
    if (!fm.created) fm.created = today();
    fm.updated = today();
    validate(fm);
    atomicWrite(p, dumpNote(fm, body || ""));
    return { path: this._rel(p) };
  }

  append(rel, text, create = false, frontmatter = null) {
    const p = this._resolve(rel);
    if (!fs.existsSync(p)) {
      if (!create) throw new StoreError(`note not found: ${this._rel(p)}. pass create=true to make it.`);
      return this.write(rel, frontmatter || {}, text);
    }
    const { fm, body } = parseNote(fs.readFileSync(p, "utf8"));
    fm.updated = today();
    const newBody = body.replace(/\n+$/, "") + "\n" + String(text).replace(/\n+$/, "") + "\n";
    atomicWrite(p, dumpNote(fm, newBody));
    return { path: this._rel(p) };
  }

  patch(rel, target, content) {
    const p = this._resolve(rel);
    if (!fs.existsSync(p)) throw new StoreError(`note not found: ${this._rel(p)}`);
    let { fm, body } = parseNote(fs.readFileSync(p, "utf8"));
    if (target && "frontmatter" in target) fm[target.frontmatter] = content;
    else if (target && "heading" in target) body = patchHeading(body, target.heading, content);
    else throw new StoreError("patch target must be {heading} or {frontmatter}");
    fm.updated = today();
    atomicWrite(p, dumpNote(fm, body));
    return { path: this._rel(p) };
  }

  delete(rel, confirm = true) {
    const p = this._resolve(rel);
    if (!fs.existsSync(p)) throw new StoreError(`note not found: ${this._rel(p)}`);
    const backlinks = this._backlinks(stemOf(this._rel(p)), p);
    if (!confirm) return { path: this._rel(p), deleted: false, backlinks };
    fs.unlinkSync(p);
    return { path: this._rel(p), deleted: true, backlinks };
  }

  _backlinks(stem, excludePath) {
    const re = new RegExp(`\\[\\[([^\\[\\]]*/)?${escapeRe(stem)}(\\|[^\\]]*)?\\]\\]`, "i");
    const hits = [];
    for (const f of this._allMd()) {
      if (excludePath && path.resolve(f) === path.resolve(excludePath)) continue;
      try { if (re.test(fs.readFileSync(f, "utf8"))) hits.push(this._rel(f)); } catch { /* skip */ }
    }
    return hits.sort();
  }

  _refresh() {
    const seen = new Set();
    for (const f of this._allMd()) {
      const rel = this._rel(f);
      seen.add(rel);
      let mtime;
      try { mtime = fs.statSync(f).mtimeMs; } catch { continue; }
      const c = this._cache.get(rel);
      if (c && c.mtime === mtime) continue;
      try {
        const { fm, body } = parseNote(fs.readFileSync(f, "utf8"));
        this._cache.set(rel, { mtime, path: rel, fm, body });
      } catch { /* skip unparseable */ }
    }
    for (const rel of [...this._cache.keys()]) if (!seen.has(rel)) this._cache.delete(rel);
  }

  search(query = null, where = null, includeArchived = false, limit = 20) {
    this._refresh();
    const eff = { ...(where || {}) };
    if (!("status" in eff) && !includeArchived) eff.status = { "!=": "archived" };
    let matched = [];
    for (const e of this._cache.values()) {
      if (!matchWhere(e.fm, eff)) continue;
      if (query && !textMatch(e, query)) continue;
      matched.push(e);
    }
    matched.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    matched.sort((a, b) => {
      const A = a.fm.updated || "", B = b.fm.updated || "";
      return A < B ? 1 : A > B ? -1 : 0;
    });
    let cap = parseInt(limit, 10);
    if (isNaN(cap) || cap < 0) cap = 20;
    return { count: matched.length, results: matched.slice(0, cap).map(ref) };
  }

  tagList(includeArchived = false) {
    this._refresh();
    const counts = new Map();
    for (const e of this._cache.values()) {
      if (!includeArchived && e.fm.status === "archived") continue;
      for (const t of e.fm.tags || []) counts.set(t, (counts.get(t) || 0) + 1);
    }
    const ordered = [...counts.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] < b[0] ? -1 : 1));
    return { tags: ordered.map(([tag, count]) => ({ tag, count })) };
  }

  reindex() {
    this._cache.clear();
    this._refresh();
    const g = this._buildGraph();
    let edges = 0;
    for (const m of g.out.values()) edges += m.size;
    return { notes: this._cache.size, edges };
  }

  _buildGraph() {
    this._refresh();
    const resolve = new Map();
    for (const [rel, e] of this._cache) {
      const s = stemOf(rel).toLowerCase();
      if (!resolve.has(s)) resolve.set(s, rel);
      for (const a of e.fm.aliases || []) if (typeof a === "string" && !resolve.has(a.toLowerCase())) resolve.set(a.toLowerCase(), rel);
    }
    const nodes = new Map();
    for (const [rel, e] of this._cache) nodes.set(rel, { missing: false, ...ref(e) });
    const out = new Map();
    const radj = new Map();
    const addEdge = (from, to, type) => {
      if (!out.has(from)) out.set(from, new Map());
      const m = out.get(from);
      if (!m.has(to)) m.set(to, []);
      if (!m.get(to).includes(type)) m.get(to).push(type);
      if (!radj.has(to)) radj.set(to, new Set());
      radj.get(to).add(from);
    };
    for (const [rel, e] of this._cache) {
      for (const [token, etype] of outEdges(e.fm, e.body)) {
        let target = resolve.get(token.toLowerCase()) || resolve.get(stemOf(token).toLowerCase());
        if (!target) {
          target = "?" + token;
          if (!nodes.has(target)) nodes.set(target, { missing: true, path: null, name: token, type: null, status: null, summary: null, tags: [], updated: null });
        }
        addEdge(rel, target, etype);
      }
    }
    return { nodes, out, radj, resolve };
  }

  _resolveNode(g, token) {
    token = (token || "").trim();
    if (g.nodes.has(token)) return token;
    if (g.nodes.has(token + ".md")) return token + ".md";
    const hit = g.resolve.get(stemOf(token).toLowerCase());
    if (hit) return hit;
    throw new StoreError(`note not found in graph: ${token}`);
  }

  graphNeighbours(note, depth = 1, edgeTypes = null) {
    const g = this._buildGraph();
    const start = this._resolveNode(g, note);
    const nodes = ego(g, start, Math.max(1, parseInt(depth, 10) || 1), edgeTypes);
    return { nodes: [...nodes].map((n) => nodeOut(g, n)), edges: edgesAmong(g, nodes, edgeTypes) };
  }

  graphPath(a, b, maxDepth = 6, directed = false) {
    const g = this._buildGraph();
    const na = this._resolveNode(g, a);
    const nb = this._resolveNode(g, b);
    const p = bfsPath(g, na, nb, directed);
    if (!p || p.length - 1 > maxDepth) return { path: [], edges: [] };
    return { path: p.map((n) => nodeOut(g, n)), edges: pathEdges(g, p) };
  }

  graphSubgraph(seed = null, tag = null, depth = 1) {
    const g = this._buildGraph();
    const seeds = new Set();
    if (seed) seeds.add(this._resolveNode(g, seed));
    if (tag) for (const [n, d] of g.nodes) if (!d.missing && (d.tags || []).includes(tag)) seeds.add(n);
    if (seeds.size === 0) throw new StoreError("graph_subgraph needs a seed note or a tag");
    const nodes = new Set();
    for (const s of seeds) for (const n of ego(g, s, Math.max(0, parseInt(depth, 10) || 0))) nodes.add(n);
    return { nodes: [...nodes].map((n) => nodeOut(g, n)), edges: edgesAmong(g, nodes) };
  }

  graphBacklinks(note) {
    const g = this._buildGraph();
    const n = this._resolveNode(g, note);
    const out = [];
    if (g.radj.has(n)) for (const u of g.radj.get(n)) {
      const types = g.out.get(u).get(n);
      out.push({ from: nodeOut(g, u), type: types[0] || null });
    }
    out.sort((a, b) => {
      const A = a.from.path || a.from.name || "", B = b.from.path || b.from.name || "";
      return A < B ? -1 : A > B ? 1 : 0;
    });
    return { backlinks: out };
  }

  startWatch() {
    const enabled = ["1", "true", "yes", "on"].includes(String(process.env.MEMORY_WATCH || "").toLowerCase());
    if (this._watching || !enabled) return;
    this._watching = true;
    try {
      fs.watch(this.root, { recursive: true }, () => { try { this._refresh(); } catch { /* ignore */ } });
    } catch { /* recursive watch unsupported; mtime poll covers it */ }
  }
}

function patchHeading(body, heading, content) {
  const lines = body.split("\n");
  let target = null, level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(HEADING_RE);
    if (m && m[2].trim() === heading.trim()) { target = i; level = m[1].length; break; }
  }
  if (target === null) throw new StoreError(`heading not found: ${JSON.stringify(heading)}`);
  let end = lines.length;
  for (let j = target + 1; j < lines.length; j++) {
    const m = lines[j].match(HEADING_RE);
    if (m && m[1].length <= level) { end = j; break; }
  }
  return [...lines.slice(0, target + 1), ...content.split("\n"), ...lines.slice(end)].join("\n") + "\n";
}
