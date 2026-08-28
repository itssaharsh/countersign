#!/usr/bin/env python3
"""Deterministic policy evaluation — the sandbox twin of server/src/policy.mjs.

Same input JSON, same policy.yaml, same verdict. No LLM anywhere in this path.
Usage: evaluate_policy.py <measurement.json> <policy.yaml>
"""
import json
import sys
from datetime import datetime, timezone


def parse_simple_yaml(text: str) -> dict:
    """Tiny YAML subset: scalars, string lists, comments. Mirrors tiny-yaml.mjs."""
    out, list_key = {}, None
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        if line.lstrip().startswith("- ") and list_key:
            out[list_key].append(coerce(line.lstrip()[2:]))
            continue
        if ":" in line and not line.startswith(" "):
            key, _, val = line.partition(":")
            val = val.strip()
            if val == "":
                out[key.strip()] = []
                list_key = key.strip()
            else:
                out[key.strip()] = coerce(val)
                list_key = None
    return out


def coerce(v: str):
    t = v.strip().strip("'\"")
    if t == "true":
        return True
    if t == "false":
        return False
    if t.lstrip("-").isdigit():
        return int(t)
    return t


def check(rule: str, ok: bool, detail: str) -> dict:
    return {"rule": rule, "pass": ok, "detail": detail}


def main() -> int:
    measurement = json.load(open(sys.argv[1]))
    policy = parse_simple_yaml(open(sys.argv[2]).read())
    tables = measurement.get("tables", [])
    undo = measurement.get("undo", {})

    total = sum(t.get("delta") or 0 for t in tables)
    rules = [check("max_rows_deleted", total <= policy["max_rows_deleted"],
                   f"{total} rows deleted vs limit {policy['max_rows_deleted']}")]

    touched = [t["name"] for t in tables
               if (t.get("delta") or 0) > 0 and t["name"] in policy["protected_tables"]]
    rules.append(check("protected_tables", not touched,
                       f"deletes rows in protected: {', '.join(touched)}" if touched
                       else "no protected table loses rows"))

    rules.append(check("require_verified_undo",
                       (not policy["require_verified_undo"]) or undo.get("verified") is True,
                       "undo verified against committed shadow state" if undo.get("verified")
                       else "undo NOT verified"))

    restricted = [t["name"] for t in tables
                  if t.get("onDelete") == "RESTRICT" and (t.get("affected") or 0) > 0]
    rules.append(check("restrict_edges_block", not restricted,
                       f"RESTRICT edges would abort the real run: {', '.join(restricted)}"
                       if restricted else "no RESTRICT edge in the blast path"))

    failures = [r for r in rules if not r["pass"]]
    print(json.dumps({
        "verdict": "FAIL" if failures else "PASS",
        "rules": rules,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "engine": "deterministic-v1 (no LLM in the verdict path)",
        "scope": ("Rules cover row deltas, protected tables, undo verification, RESTRICT "
                  "edges. They do NOT cover grants, triggers, sequences, or non-row side effects."),
    }, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
