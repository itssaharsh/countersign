# Workstream: skill + policy engine (skills/countersign-dossier/)

SKILL.md (frontmatter name: countersign-dossier, sharp description) + scripts/evaluate_policy.py
(deterministic: reads measurement JSON + policy.yaml → verdict JSON with per-rule pass/fail,
NO LLM in the verdict path) + scripts/render_dossier.py (HTML + SVG receipt) + references/policy.yaml
(max_rows_deleted, protected_tables, require_verified_undo, business_hours guard...).
Dual path: engine importable by server/ when sandbox unavailable (Node child_process python3, or
port evaluator to TS — decide by what's testable fastest; document choice in docs/EXPLAIN.md).
Registered from THIS public repo via Settings → Skills once pushed.

## Acceptance
Same measurement JSON → identical verdict via sandbox path and server path; dossier HTML renders
standalone; policy failure blocks commit (server refuses without PASS).
