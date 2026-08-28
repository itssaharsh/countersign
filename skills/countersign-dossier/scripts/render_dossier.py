#!/usr/bin/env python3
"""Render the Countersign approval dossier as a standalone HTML file.
Usage: render_dossier.py <measurement.json> <verdict.json> <out.html>
"""
import html
import json
import sys


def main() -> int:
    m = json.load(open(sys.argv[1]))
    v = json.load(open(sys.argv[2]))
    rows = "".join(
        f"<tr><td>{html.escape(t['name'])}</td>"
        f"<td class='n'>{(t.get('delta') or 0):,}</td>"
        f"<td>{html.escape(t.get('onDelete') or '—')}</td></tr>"
        for t in m.get("tables", []) if (t.get("delta") or 0) > 0 or t.get("edge") is None)
    rules = "".join(
        f"<li class={'ok' if r['pass'] else 'bad'}>{'■' if r['pass'] else '✕'} "
        f"<b>{html.escape(r['rule'])}</b> — {html.escape(r['detail'])}</li>"
        for r in v.get("rules", []))
    fp = m.get("fingerprint") or {}
    doc = f"""<!doctype html><meta charset="utf-8"><title>Countersign Dossier</title>
<style>
body{{background:#06090c;color:#c7d5df;font-family:'JetBrains Mono',monospace;max-width:820px;margin:2rem auto;padding:0 1rem}}
h1{{color:#ffb454;letter-spacing:.15em;font-size:1.1rem}} .stamp{{border:2px solid #ffb454;color:#ffb454;display:inline-block;padding:.2em .6em;transform:rotate(-2deg)}}
table{{width:100%;border-collapse:collapse;margin:1rem 0}} td,th{{border:1px solid #1c2a36;padding:.35em .6em;text-align:left}} .n{{text-align:right;color:#ff5d5d}}
.ok{{color:#5dffa3}} .bad{{color:#ff5d5d}} li{{margin:.3em 0;list-style:none}} code{{color:#ffb454}} .dim{{color:#61788a;font-size:.8em}}
</style>
<h1>⬢ COUNTERSIGN DOSSIER <span class="stamp">{html.escape(v.get('verdict','?'))}</span></h1>
<p>Change under review:<br><code>{html.escape(m.get('change_sql',''))}</code></p>
<h1>Measured blast radius</h1>
<table><tr><th>table</th><th>rows lost</th><th>on delete</th></tr>{rows}</table>
<p class="dim">Fingerprint: {fp.get('count','?')} rows · pk sha256 {html.escape(str(fp.get('pk_hash',''))[:16])}… ·
measured {html.escape(str(fp.get('measured_at','')))}</p>
<h1>Policy</h1><ul>{rules}</ul>
<p class="dim">{html.escape(v.get('scope',''))} · engine: {html.escape(v.get('engine',''))}</p>
<p class="dim">We only delete what we can prove we can restore.</p>"""
    open(sys.argv[3], "w").write(doc)
    print(f"dossier -> {sys.argv[3]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
