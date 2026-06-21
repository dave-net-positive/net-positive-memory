#!/usr/bin/env python3
"""Build a self-contained HTML graph explorer from a Net Positive Memory snapshot."""
import json, os, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
data = json.load(open(os.path.join(HERE, "data.json")))

def stem(p):
    base = p.replace("\\", "/").split("/")[-1]
    return base[:-3] if base.endswith(".md") else base

# real nodes
nodes = []
real_ids = set()
for n in data["nodes"]:
    real_ids.add(n["path"])
    nodes.append({"data": {
        "id": n["path"],
        "label": stem(n["path"]),
        "ntype": n["type"] or "untyped",
        "status": n["status"] or "untyped",
        "summary": n["summary"] or "",
        "tags": n["tags"] or [],
        "updated": n["updated"] or "",
        "missing": False,
    }})

# missing nodes referenced by edges
missing = {}
for e in data["edges"]:
    for end in (e["from"], e["to"]):
        if end not in real_ids and end.startswith("?"):
            missing.setdefault(end, {"data": {
                "id": end, "label": end[1:], "ntype": "missing", "status": "missing",
                "summary": "Referenced by a link but no note exists with this name.",
                "tags": [], "updated": "", "missing": True,
            }})
nodes.extend(missing.values())

edges = []
for i, e in enumerate(data["edges"]):
    edges.append({"data": {"id": "e%d" % i, "source": e["from"], "target": e["to"], "etype": e["type"]}})

elements = {"nodes": nodes, "edges": edges}
meta = {
    "generated": datetime.date.today().isoformat(),
    "notes": len([n for n in nodes if not n["data"]["missing"]]),
    "missing": len(missing),
    "edges": len(edges),
}

TEMPLATE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Net Positive Memory - Graph</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.30.2/cytoscape.min.js"></script>
<style>
  :root{
    --bg:#0f172a; --panel:#1e293b; --panel2:#172033; --line:#334155;
    --text:#e2e8f0; --muted:#94a3b8; --ember:#e0783a; --ember-soft:#f4a463;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;background:var(--bg);color:var(--text);
    font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
  #app{display:flex;flex-direction:column;height:100vh}
  header{display:flex;align-items:center;gap:14px;padding:10px 16px;background:var(--panel);
    border-bottom:1px solid var(--line);flex-wrap:wrap}
  header h1{font-size:15px;margin:0;font-weight:700;letter-spacing:.3px;
    font-family:'Barlow Condensed',sans-serif;text-transform:uppercase}
  header h1 b{color:var(--ember)}
  .meta{color:var(--muted);font-size:12px}
  .spacer{flex:1}
  input[type=search]{background:var(--panel2);border:1px solid var(--line);color:var(--text);
    border-radius:8px;padding:7px 11px;width:230px;font-size:13px;outline:none}
  input[type=search]:focus{border-color:var(--ember)}
  .btn{background:var(--panel2);border:1px solid var(--line);color:var(--text);
    border-radius:8px;padding:7px 11px;font-size:12px;cursor:pointer}
  .btn:hover{border-color:var(--ember);color:#fff}
  .toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer;user-select:none}
  .toggle input{accent-color:var(--ember)}
  main{flex:1;display:flex;min-height:0}
  #cy{flex:1;min-width:0}
  aside{width:340px;background:var(--panel);border-left:1px solid var(--line);
    padding:18px;overflow:auto}
  aside .empty{color:var(--muted);font-size:13px;line-height:1.6}
  .legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
  .chip{display:flex;align-items:center;gap:6px;font-size:11px;padding:4px 9px;border-radius:999px;
    background:var(--panel2);border:1px solid var(--line);cursor:pointer;user-select:none;text-transform:capitalize}
  .chip .dot{width:9px;height:9px;border-radius:50%}
  .chip.off{opacity:.35}
  .title{font-family:'Barlow Condensed',sans-serif;font-size:22px;font-weight:600;
    line-height:1.15;margin:0 0 4px;word-break:break-word}
  .path{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;color:var(--muted);
    margin-bottom:12px;word-break:break-all}
  .badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
  .badge{font-size:11px;padding:3px 9px;border-radius:6px;background:var(--panel2);border:1px solid var(--line);text-transform:capitalize}
  .summary{font-size:13px;line-height:1.6;margin-bottom:14px}
  .sec{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);
    margin:14px 0 7px;font-weight:700}
  .tags{display:flex;flex-wrap:wrap;gap:5px}
  .tag{font-size:11px;padding:2px 8px;border-radius:6px;background:rgba(224,120,58,.12);
    color:var(--ember-soft);border:1px solid rgba(224,120,58,.25)}
  .links{display:flex;flex-direction:column;gap:3px}
  .lnk{display:flex;align-items:center;gap:8px;font-size:12px;padding:5px 8px;border-radius:7px;
    cursor:pointer;color:var(--text);background:var(--panel2)}
  .lnk:hover{background:#243044}
  .lnk .et{font-size:10px;color:var(--muted);margin-left:auto;text-transform:uppercase}
  .lnk .dot{width:8px;height:8px;border-radius:50%;flex:none}
  .hint{font-size:11px;color:var(--muted);margin-top:8px}
  a{color:var(--ember-soft)}
</style>
</head>
<body>
<div id="app">
  <header>
    <h1>Net&nbsp;<b>Positive</b>&nbsp;Memory</h1>
    <span class="meta">__META_NOTES__ notes &middot; __META_EDGES__ links &middot; snapshot __META_DATE__</span>
    <div class="spacer"></div>
    <input id="search" type="search" placeholder="Search notes, summaries, tags...">
    <label class="toggle"><input type="checkbox" id="tMention" checked> mentions</label>
    <label class="toggle"><input type="checkbox" id="tMissing"> missing</label>
    <button class="btn" id="relayout">Re-layout</button>
    <button class="btn" id="fit">Fit</button>
  </header>
  <main>
    <div id="cy"></div>
    <aside id="panel">
      <div class="empty">
        Click any node to inspect it.<br><br>
        Nodes are notes, sized by how connected they are. Solid lines are typed links
        (<i>related</i> and friends); dashed lines are inline <i>mentions</i>. Colour is the note type.
        <div class="legend" id="legend"></div>
        <div class="hint">Tip: click a type below to toggle it. Use search to dim everything but the matches.</div>
      </div>
    </aside>
  </main>
</div>
<script>
const ELEMENTS = __ELEMENTS__;
const COLORS = {
  project:"#e0783a", entity:"#38bdf8", decision:"#a78bfa", session:"#4ade80",
  reference:"#f4a463", index:"#fbbf24", actions:"#f87171", timeline:"#2dd4bf",
  blog:"#c084fc", concept:"#f472b6", untyped:"#64748b", missing:"#475569"
};
const colorFor = t => COLORS[t] || "#64748b";

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements: ELEMENTS,
  wheelSensitivity: 0.25,
  style: [
    { selector:'node', style:{
      'background-color': ele => colorFor(ele.data('ntype')),
      'label':'data(label)', 'color':'#cbd5e1', 'font-size':'10px',
      'font-family':'JetBrains Mono, monospace',
      'text-valign':'bottom','text-margin-y':4,'text-wrap':'wrap','text-max-width':'120px',
      'width': ele => 16 + Math.min(ele.degree()*4, 40),
      'height': ele => 16 + Math.min(ele.degree()*4, 40),
      'border-width':1.5,'border-color':'#0f172a'
    }},
    { selector:'node[?missing]', style:{
      'background-opacity':0.12,'border-color':'#475569','border-style':'dashed',
      'border-width':1.5,'color':'#64748b'
    }},
    { selector:'edge', style:{
      'width':1.2,'line-color':'#475569','curve-style':'bezier',
      'target-arrow-color':'#475569','target-arrow-shape':'triangle','arrow-scale':0.7,
      'opacity':0.55
    }},
    { selector:'edge[etype="related"]', style:{ 'line-color':'#e0783a','target-arrow-color':'#e0783a','opacity':0.8,'width':1.6 }},
    { selector:'edge[etype="mention"]', style:{ 'line-style':'dashed' }},
    { selector:'.dim', style:{ 'opacity':0.08 }},
    { selector:'.hl', style:{ 'border-width':3,'border-color':'#fff' }},
    { selector:'.faded', style:{ 'display':'none' }}
  ],
  layout: { name:'cose', animate:false, padding:40, nodeRepulsion:9000, idealEdgeLength:90, gravity:0.3 }
});

// legend
const types = [...new Set(ELEMENTS.nodes.map(n=>n.data.ntype))].sort();
const legend = document.getElementById('legend');
const hidden = new Set();
types.forEach(t=>{
  const c = document.createElement('span'); c.className='chip'; c.dataset.t=t;
  c.innerHTML = '<span class="dot" style="background:'+colorFor(t)+'"></span>'+t;
  c.onclick = ()=>{ c.classList.toggle('off'); hidden.has(t)?hidden.delete(t):hidden.add(t); applyFilters(); };
  legend.appendChild(c);
});

function applyFilters(){
  const showMention = document.getElementById('tMention').checked;
  const showMissing = document.getElementById('tMissing').checked;
  cy.batch(()=>{
    cy.nodes().forEach(n=>{
      let vis = !hidden.has(n.data('ntype'));
      if(n.data('missing') && !showMissing) vis=false;
      n.toggleClass('faded', !vis);
    });
    cy.edges().forEach(e=>{
      let vis = !e.source().hasClass('faded') && !e.target().hasClass('faded');
      if(e.data('etype')==='mention' && !showMention) vis=false;
      e.toggleClass('faded', !vis);
    });
  });
}
document.getElementById('tMention').onchange=applyFilters;
document.getElementById('tMissing').onchange=applyFilters;

// details panel
const panel = document.getElementById('panel');
function dotSpan(t){ return '<span class="dot" style="background:'+colorFor(t)+'"></span>'; }
function showNode(n){
  const d=n.data();
  const out = n.outgoers('edge').map(e=>({n:e.target(),t:e.data('etype'),dir:'->'}));
  const inc = n.incomers('edge').map(e=>({n:e.source(),t:e.data('etype'),dir:'<-'}));
  const linkRows = arr => arr.map(x=>
    '<div class="lnk" data-id="'+encodeURIComponent(x.n.id())+'">'+dotSpan(x.n.data('ntype'))+
    '<span>'+x.n.data('label')+'</span><span class="et">'+x.t+'</span></div>').join('') || '<div class="hint">none</div>';
  panel.innerHTML =
    '<div class="title">'+d.label+'</div>'+
    (d.missing?'':'<div class="path">'+d.id+'</div>')+
    '<div class="badges">'+
      '<span class="badge">'+dotSpan(d.ntype)+' '+d.ntype+'</span>'+
      (d.status&&d.status!=='untyped'&&d.status!=='missing'?'<span class="badge">'+d.status+'</span>':'')+
      (d.updated?'<span class="badge">updated '+d.updated+'</span>':'')+
    '</div>'+
    (d.summary?'<div class="summary">'+d.summary+'</div>':'')+
    (d.tags&&d.tags.length?'<div class="sec">Tags</div><div class="tags">'+d.tags.map(t=>'<span class="tag">'+t+'</span>').join('')+'</div>':'')+
    '<div class="sec">Links out ('+out.length+')</div><div class="links">'+linkRows(out)+'</div>'+
    '<div class="sec">Links in ('+inc.length+')</div><div class="links">'+linkRows(inc)+'</div>';
  panel.querySelectorAll('.lnk').forEach(el=>{
    el.onclick=()=>{ const t=cy.getElementById(decodeURIComponent(el.dataset.id)); if(t){ select(t); cy.animate({center:{eles:t},zoom:1.4},{duration:300}); } };
  });
}
function select(n){
  cy.elements().removeClass('hl');
  n.addClass('hl');
  cy.elements().addClass('dim');
  const nb=n.closedNeighborhood(); nb.removeClass('dim');
  showNode(n);
}
cy.on('tap','node',e=>select(e.target));
cy.on('tap',e=>{ if(e.target===cy){ cy.elements().removeClass('dim hl'); } });

// search
document.getElementById('search').addEventListener('input',ev=>{
  const q=ev.target.value.trim().toLowerCase();
  if(!q){ cy.nodes().removeClass('dim'); return; }
  cy.batch(()=>{
    cy.nodes().forEach(n=>{
      const d=n.data();
      const hay=(d.label+' '+d.summary+' '+(d.tags||[]).join(' ')+' '+d.id).toLowerCase();
      n.toggleClass('dim', !hay.includes(q));
    });
  });
});

document.getElementById('fit').onclick=()=>cy.animate({fit:{padding:40}},{duration:300});
document.getElementById('relayout').onclick=()=>cy.layout({name:'cose',animate:true,padding:40,nodeRepulsion:9000,idealEdgeLength:90,gravity:0.3}).run();

applyFilters();
</script>
</body>
</html>
"""

html = (TEMPLATE
        .replace("__ELEMENTS__", json.dumps(elements))
        .replace("__META_NOTES__", str(meta["notes"]))
        .replace("__META_EDGES__", str(meta["edges"]))
        .replace("__META_DATE__", meta["generated"]))

out = "/mnt/user-data/outputs/net-positive-memory-graph.html"
open(out, "w").write(html)
print("wrote", out)
print("meta:", meta)
