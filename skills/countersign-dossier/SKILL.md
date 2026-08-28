---
name: countersign-dossier
description: Evaluate a Countersign measurement JSON against policy.yaml with the deterministic rules engine, and render the approval dossier (HTML + receipt). Use when a simulation measurement needs a policy verdict or a human-readable dossier. The verdict comes from code, never from you.
---

# Countersign Dossier

You are working with a **measurement JSON** produced by the countersign MCP server's
`simulate_change` tool. Your job here is procedural — the judgment is made by code:

1. Save the measurement JSON to a file (e.g. `/tmp/measurement.json`).
2. Run the deterministic policy evaluator:

   ```bash
   python3 scripts/evaluate_policy.py /tmp/measurement.json references/policy.yaml > /tmp/verdict.json
   cat /tmp/verdict.json
   ```

3. Report the verdict EXACTLY as printed. Never soften a FAIL, never upgrade a PASS,
   never claim a rule result the script did not print.
4. If a dossier is requested, render it:

   ```bash
   python3 scripts/render_dossier.py /tmp/measurement.json /tmp/verdict.json /tmp/dossier.html
   ```

   and offer `/tmp/dossier.html` as a downloadable artifact.

## Rules you never break
- The model proposes; only code blesses. If the script fails, report the error —
  do not hand-compute a verdict.
- Quote row counts exactly as measured. "NOT RESTORED BY THE GENERATED ROLLBACK"
  is the strongest claim you may make about a failed undo.
