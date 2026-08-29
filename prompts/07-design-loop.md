# 07 · Design loop — the console as an award-quality interactive experience

Role: you are the lead creative frontend engineer and interaction designer on Countersign.
The console is not a SaaS dashboard. It is the place where a human decides whether a
destructive database change happens, and the page around it explains why that decision
can be made honestly. Judges see it for three minutes on video and in a browser.

## Tools and how to use them

- **21st MCP** (when connected): search the catalog before building any major visual
  component. Look for animated heroes, glass interfaces, particles, shaders, magnetic
  interactions and premium transitions. Prefer a distinctive existing component over a
  generic card or gradient. Record what was taken and from where in docs/EXPLAIN.md.
- **Playwright** (MCP when connected, else tools/design-review.mjs and tools/screenshot-scroll.mjs):
  the visual QA loop. Run the app, open it, inspect every section, hover, click, scroll,
  screenshot at desktop (1920×1080) and mobile (390×844), find anything generic, static,
  awkward or cheap, fix it, re-test.
- **Libraries already in the build**: three.js + react-three-fiber (the stage), framer-motion
  (in-view reveals, magnetic, springs), GSAP ScrollTrigger (scrubbed text reveal, sticky
  stack), Lenis (smooth scroll), MagicUI and Aceternity patterns rebuilt in src/story/fx.tsx
  (marquee, border beam, number ticker, spotlight card, sticky stack, text reveal).

## The product, in phases (this is what the motion must communicate)

- IDLE: the database is a galaxy of rows you can drag. The order line waits.
- INVESTIGATING: the doomed rows ignite and gather into users, orders, payments; beams draw
  the cascade; counts float. The agent's words type in the dock.
- DECIDING: TrueForge is paused. The doomed set breathes inside a ring whose arc is the
  120 s freshness. COUNTERSIGN and DENY exist only now. Blocked when a proof is missing.
- WITNESSING: the rows vortex away; the receipt lands; the undo is armed.
- Then the page scrolls: the story explains the four proofs, the numbers from the real
  run, how TrueForge is load-bearing, the review trail, and how to run it.

## Design language

cinematic · dark base · one deliberate colour interruption (the Problem section) · glass
and translucent materials · layered depth (the galaxy bleeds through the story) · subtle
bloom · fluid, scrubbed motion · spatial transitions between phases · strong typography
(Syne display, Instrument Serif for the human voice, JetBrains Mono for evidence) ·
asymmetrical composition · lots of negative space · premium micro-interactions (magnetic
buttons, pointer spotlight, number tickers) · a different accent world per section.

Copy: plain, concrete sentences about what Countersign does. No dashes as decoration,
no "seamless", no "leverage", no marketing filler. Numbers come from the recorded run.

## Do not

- generic Tailwind dashboard layouts, three equal feature cards in a row
- navbar / hero / features / testimonials templates
- excessive rounded rectangles, random gradients as decoration
- animations that do not communicate state or reading progress
- the same accent colour in every section
- any element that can collide with another at any viewport (the order, the agent's
  words, the transcript and the title each own a region; verify with the review tool)

## The loop (run it until nothing generic is left)

1. `node tools/design-review.mjs <outdir>` → shots per section at both viewports, hover
   states, and report.json (horizontal overflow, overlapping text blocks, clipped text,
   tiny text, unnamed controls, small tap targets, heading order).
2. Experience the site as a first-time user from the shots: first impression, typography,
   spacing, hierarchy, motion quality, hover states, timing, mobile, loading, empty
   states, accessibility, anything that reads as generated UI.
3. Write the ten biggest problems, ranked. Fix the top five. Re-run step 1. Repeat.
4. Verify the live console still works: `node tools/probe-replay.mjs` (holds at the gate,
   countersign, witnessing with receipt) with zero console errors.
5. Ship through a PR reviewed by Qodo; regenerate docs/screenshots; update EXPLAIN.md.

## Definition of done

- No overlap, clipping or horizontal overflow at 1920×1080 and 390×844.
- Every section has its own accent world; the hero keeps state colours for state only.
- Motion is scrubbed to scroll or tied to phase; nothing loops for decoration except the
  marquee and the border beam.
- The story reads as a product explanation a judge could repeat back: the problem, the
  four proofs, the numbers, the harness, the review trail, how to run it.
- prefers-reduced-motion: stage settles and holds, no scrubbed opacity, native cursor.
