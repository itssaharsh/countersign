# Demo video — beats + spoken narration (~3:00)

Record 1080p with Cursorful (auto-zoom on click). Edit via Descript MCP (Underlord: trim dead air,
remove filler words, Studio Sound, bold captions, "hide my jumpcuts by adding zooms").
Insurance: pre-record the full happy path Day 2 night. Speak slowly; short sentences.

[0:00–0:18] COLD OPEN — screen: TrueForge's DEFAULT approval dialog, tool name + raw JSON args.
SAY: "This is an approval prompt. A tool name. Raw JSON. If I click Allow — what happens?
I do not know. And I am the safety layer. This is not a control. It is a consent form."

[0:18–0:32] THESIS — screen: Countersign console title card.
SAY: "Countersign fixes this. It runs the change first, on a copy. It measures what dies.
It proves the undo. Only then, the Allow button exists."

[0:32–1:10] THE RUN — screen: PR opens; agent starts; cascade tree grows live; undo check on
shadow DB; policy PASS.
SAY: "A migration lands in a pull request. The TrueForge agent picks it up. It runs the delete
inside a shadow transaction. These are real MCP tools. Watch the blast radius. Twelve thousand
users. They pull forty-eight thousand orders. Orders pull fifty-one thousand payments. Every arrow
is a real foreign key. Next, the undo. Countersign restores a second database, and checks every
row came back. Same keys. Proven. Last, the policy check runs as code. The model proposes.
Only code approves."

[1:10–1:25] MATCH CONTROL — screen: a reversible migration; compact inline gate; verdict MATCH.
SAY: "A control test. This second migration is safe and reversible. Countersign measures it —
and steps aside. Small risk, small gate. The instrument can say yes and no."

[1:25–1:50] DRIFT KILL — screen: ARMED gate, freshness meter; concurrent writer inserts rows;
STALE; direct tool call refused by server.
SAY: "Back to the dangerous one. The gate is armed. Now a coworker writes new rows. Countersign
sees the drift. The approval goes stale. The button locks. Can I cheat? I call the commit tool
directly. The server refuses. No fresh proof, no commit. The gate is real. It is not CSS."

[1:50–2:35] FINALE — screen: re-measure; TrueForge pause (tool.approval_required); Approve;
live query: rows gone; fire undo; live query: rows back.
SAY: "We measure again. Fresh numbers. TrueForge pauses the agent for a human. This is the real
approval event. I approve. The commit runs on the live database. Look — the rows are gone. This
was real. Now the armed undo. Fire. Count them again. Every row is back. Same keys. That is the
whole promise: we only delete what we can prove we can restore."

[2:35–3:00] RECEIPT + CLOSE — screen: receipt comment lands on the PR; repo; disclosure line;
(optional 3s: our filed TrueForge issue).
SAY: "The receipt posts to the pull request, where reviewers live. Every project this week ships
an Allow button. Countersign is the button that shows you the consequence — before you sign.
Built solo in three days, with AI assistance, disclosed in the repo. Thank you."
