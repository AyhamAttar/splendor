# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

2–4 people playing one game together. As built, they share a single device and pass it around (co-located, turn-based hotseat). The owner intends to add remote players on their own devices, which introduces a per-player single-device view alongside the shared one. Players span newcomers learning the rules and people who already know the game and want a fast digital table.

## Product Purpose

A digital implementation of the tabletop gem-and-prestige engine-builder: each turn a player takes gem tokens, buys development cards that grant permanent gem discounts and prestige, reserves cards, and attracts nobles; the first to 15 prestige triggers a final round and the highest prestige wins (ties broken by fewest cards). The purpose is a faithful, fast, good-looking way to play without the physical box — and, per the owner, to grow into a public product people choose to play.

## Positioning

Authoritative-engine fidelity with instant client-side feedback. The rules engine is server-authoritative and test-covered, yet mirrored to the client so the UI previews legality, affordability, auto-payment, and noble eligibility with no round-trip — a rules-tight game that still feels immediate. A neighboring "just a Splendor clone" typically puts rules in the client or the server but not both in lockstep; this does, which is what keeps previews trustworthy.

## Operating Context

- A full game is one continuous session for 2–4 players. The current build resumes an in-progress game from a session token in the browser.
- One action per turn (take gems / buy / reserve / pass). Forced sub-decisions surface as dialogs — return tokens when over the 10-token cap, choose among multiple qualifying nobles — and the game ends on a standings screen.
- The frontend talks to a REST backend that holds and validates game state. Today that store is in-memory and single-instance.

## Capabilities and Constraints

- **Confirmed today:** 2–4 player hotseat on one device; seeded, deterministic setup; full base-game rules (90 development cards across 3 tiers; 12 noble tiles, of which players+1 are revealed per game); server-authoritative turns with optimistic concurrency (`expectedTurn`) and stale-turn recovery; browser-session resume; illustrated noble and card art with a pure-CSS fallback.
- **Planned (owner intent):** online multiplayer — networked play across devices, with the accounts, lobby/matchmaking, real-time sync, and durable persistence it implies. This is a durable roadmap fact: new work should not foreclose it. The current localStorage session identity and in-memory, single-instance store are provisional and will need to become per-account and durable.
- **Shipping as a public product** is the stated goal, raising the bar on robustness, first-run guidance, and device/accessibility coverage beyond a personal build.
- **Undecided:** authentication model, persistence/hosting, spectating, and single-player-vs-AI (raised as a possible direction, not committed). Accessibility standard is a target to confirm (see below).

## Brand Commitments

None are binding yet — the owner is open to rebranding both the name and the visual world, so neither the working title **"Splendor"** nor the current Renaissance gold/parchment look is fixed identity. Load-bearing constraint: **"Splendor" is a trademarked published game** (Space Cowboys / Asmodee, 2014). A public launch under that exact name and art direction carries trademark/IP risk, so an original name and visual identity are likely prerequisites to shipping. Game terminology (prestige, nobles, development cards, gem colors) is domain vocabulary, not brand.

## Evidence on Hand

- The working game is the primary proof: a playable frontend plus a test-covered backend engine (60 passing engine tests).
- Assets present: 12 noble illustrations at `frontend/public/assets/Nobels Itemes/`, and real photographic card art (`.webp`) at `frontend/public/assets/Cards/` covering a fixed, scattered subset of the 90 development cards; the rest fall back to a pure-CSS parchment card face.
- No real users, testimonials, metrics, press, hosting, or launch facts exist yet; future work must not fabricate them. There is no logo and no finalized name.

## Product Principles

1. Rules fidelity is non-negotiable: the server engine is the source of truth; the client may preview but never diverge in outcome.
2. Immediate feedback: show legal moves, costs, and consequences before commit, so the game feels responsive and teaches as it goes.
3. Design for the table that isn't there yet: keep the door open to remote multiplayer and accounts rather than hard-coding the single-device, single-session assumption.
4. Ship-quality baseline: because real users are the goal, robustness, first-run clarity, and inclusive access are requirements, not extras.
5. Own the identity before launch: treat the name and Renaissance look as replaceable, and resolve the trademark/branding question before any public release.

## Accessibility & Inclusion

No product-specific standard is set yet. Because the goal is a public launch, treat **WCAG 2.1 AA as the working target, to confirm** with the owner. Known gaps in the current build to address under that target: modal focus management and Escape-to-close; keyboard operability of the press-and-hold card "peek"; visible focus indicators; and never relying on gem color alone (text labels already exist — keep them).
