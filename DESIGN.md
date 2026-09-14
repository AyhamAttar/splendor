---
name: Splendor (working title)
description: A lit Renaissance jeweler's table — gems and prestige on velvet under candlelight.
colors:
  navy-950: "#081226"
  navy-900: "#0c1b3a"
  navy-800: "#142a52"
  navy-700: "#1c3866"
  gold-300: "#ecd9a0"
  gold-400: "#d9b45b"
  gold-500: "#c19a3f"
  gold-700: "#8a6d2a"
  parchment-50: "#faf3e3"
  parchment-100: "#f1e6cc"
  parchment-300: "#dcc9a3"
  gem-white: "#f4f1ea"
  gem-blue: "#1f5fbf"
  gem-green: "#1c8a4e"
  gem-red: "#c22f2f"
  gem-black: "#232128"
  gem-gold: "#e3b341"
typography:
  display:
    fontFamily: "'Thmanyah Serif Display', Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif"
    fontSize: "3.75rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "0.02em"
  title:
    fontFamily: "'Thmanyah Serif Display', Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif"
    fontSize: "1.25rem"
    fontWeight: 700
    letterSpacing: "0.02em"
  body:
    fontFamily: "'Thmanyah Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "'Thmanyah Serif Display', Georgia, 'Iowan Old Style', 'Palatino Linotype', 'Times New Roman', serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    letterSpacing: "0.22em"
rounded:
  hairline: "3px"
  sm: "0.25rem"
  md: "0.375rem"
  lg: "0.5rem"
  card: "0.7rem"
  xl: "0.75rem"
  full: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.gold-500}"
    textColor: "{colors.navy-950}"
    rounded: "{rounded.sm}"
    padding: "0.375rem 1rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-400}"
    textColor: "{colors.navy-950}"
  button-ghost:
    textColor: "{colors.parchment-300}"
  button-ghost-hover:
    textColor: "{colors.parchment-100}"
  cta-primary:
    backgroundColor: "{colors.gold-500}"
    textColor: "{colors.navy-950}"
    typography: "{typography.title}"
    rounded: "{rounded.lg}"
    padding: "0.75rem 1rem"
  input-field:
    backgroundColor: "{colors.navy-950}"
    textColor: "{colors.parchment-50}"
    rounded: "{rounded.md}"
    padding: "0.625rem 0.75rem"
  card-face:
    backgroundColor: "{colors.parchment-50}"
    textColor: "{colors.navy-900}"
    rounded: "{rounded.card}"
    padding: "0.5rem"
    height: "9rem"
    width: "6rem"
  card-back:
    backgroundColor: "{colors.navy-950}"
    textColor: "{colors.gold-300}"
    rounded: "{rounded.card}"
    height: "9rem"
    width: "6rem"
  panel:
    backgroundColor: "{colors.navy-800}"
    textColor: "{colors.parchment-50}"
    rounded: "{rounded.lg}"
    padding: "0.75rem"
  modal:
    backgroundColor: "{colors.navy-800}"
    textColor: "{colors.parchment-50}"
    rounded: "{rounded.xl}"
    padding: "1.25rem"
  noble-tile:
    backgroundColor: "{colors.parchment-50}"
    textColor: "{colors.navy-900}"
    rounded: "{rounded.card}"
    height: "5rem"
    width: "5rem"
---

<!-- impeccable:design-schema 1 -->

# Design System: Splendor (working title)

## Overview

**Creative North Star: "A Lit Renaissance Jeweler's Table"**

The whole interface is staged as one physical scene: a deep navy velvet tabletop, lit from above by a stable pool of candlelight that deepens to a vignette at the edges, on which gilt-framed cards, domed gem tokens, and parchment tiles are laid out like real pieces. Nothing floats in flat UI space — every surface reads as an object resting on felt, caught in warm light, edged in gold. Depth is achieved with real offset-and-cast shadows warmed toward the table (never rings or glows), and the palette is disciplined: navy for the ground, a four-step gold for every frame and engraving, warm parchment for anything a hand would pick up, and six saturated jewel colors that carry the game's meaning.

The mood is opulent but legible — a rulebook illustration you can actually operate. Type splits cleanly: engraved Georgia serif for anything titular or ceremonial (the wordmark, prestige numbers, small-caps section labels), plain system sans for the running text of play. Iconography is entirely hand-drawn SVG strokes; there are no emoji or icon-font glyphs anywhere in the chrome. Motion is rationed to a single authored moment — pieces settling onto the felt in an orchestrated stagger when a view mounts — plus one slow candlelit "breath" on whichever player is currently in play and a brief, self-dismissing reward flourish when a player wins a card or noble. Everything else is instant.

The world is deliberately maximal in finish (gold double-line frames, candlelight, velvet texture) but restrained in behavior: no gratuitous animation, no decorative color outside its role, no depth cue that isn't a believable shadow. Note: the working name "Splendor" and this Renaissance look are provisional per PRODUCT.md — an original name and identity are expected before any public launch — but as-built, this is the coherent system to stay on-brand with.

**Key Characteristics:**
- A navy velvet ground under a fixed candlelight vignette; pieces sit *on* it, never in flat space.
- One four-step gold (`gold-300`→`gold-700`) owns every frame, hairline, label, and highlight.
- Three real cast-shadow elevations (`raise-1/2/3`); halos and ring-glows are banned as depth cues.
- Ornate gold double-line frame for hero surfaces; single gold hairline for smaller/quieter ones.
- Engraved Georgia serif for the ceremonial layer; system sans for running gameplay text.
- Hand-drawn SVG icons only — no emoji, no icon fonts in the chrome.
- One authored motion moment (`rise-in` stagger) plus a `turn-breath` on the active player and a brief event-triggered reward flourish; `prefers-reduced-motion` fully honored.

## Colors

A tight, role-locked palette: cool navy is the table, a warm four-step gold is every edge and engraving, parchment is anything picked up by hand, and six saturated jewel hues carry the only "loud" color — reserved for game meaning.

### Primary
- **Antique Gold (frame & engraving)** — a four-step warm ramp used for every ornate edge, highlight, and titular text:
  - **Gilt Highlight** (`gold-300` #ecd9a0): the lightest gold — the wordmark and all serif headings, deck pips, the small-caps ornament labels, "turn" chips, hairline ring accents.
  - **Lamp Gold** (`gold-400` #d9b45b): the mid highlight — selection/affordable rings, focus outlines, selection caret, `::selection` background, the diamond ornament, primary-button hover.
  - **Frame Gold** (`gold-500` #c19a3f): the structural line — the inner 2px stroke of the gold double-line frame, primary button/CTA fill, scrollbar thumb.
  - **Shadow Gold** (`gold-700` #8a6d2a): the deepest gold — the outermost 1px frame border, hairline borders, scrollbar track/thumb base, header divider.

### Secondary
- **Table Navy (the ground & raised surfaces)** — a four-step cool ramp from the felt up:
  - **Velvet Black-Navy** (`navy-950` #081226): the base table color, input field fills, modal/action-bar scrims, badge backgrounds.
  - **Deep Navy** (`navy-900` #0c1b3a): the top of the body gradient; inactive/quiet panel and log backgrounds.
  - **Lit Navy** (`navy-800` #142a52): the raised, in-light surface — active player panels, the lobby form, modal panels, resume card.
  - **Candlelit Navy** (`navy-700` #1c3866): the lightest navy — the candlelight pool center and the top of the striped card-back gradient.

### Tertiary
- **Parchment (anything a hand picks up)** — warm paper for card faces, noble tiles, and light-on-dark text:
  - **Fresh Parchment** (`parchment-50` #faf3e3): the top of card/noble face gradients; the brightest running text (player names on panels, input text).
  - **Aged Parchment** (`parchment-100` #f1e6cc): secondary body copy inside dark surfaces (resume line, error/fallback text).
  - **Worn Parchment** (`parchment-300` #dcc9a3): the bottom of card-face gradients and the muted-text workhorse (used at ~40–80% opacity for meta, captions, placeholders).

### Named Rules
**The Gem-Meaning Rule.** The six jewel colors — **Diamond/white** (`gem-white` #f4f1ea), **Sapphire/blue** (`gem-blue` #1f5fbf), **Emerald/green** (`gem-green` #1c8a4e), **Ruby/red** (`gem-red` #c22f2f), **Onyx/black** (`gem-black` #232128), **Gold** (`gem-gold` #e3b341) — appear *only* on game pieces that mean that color: token chips, cost/bonus pips, gem discs. They are never used as decorative accents or UI chrome. Gem color always ships with a text label (Diamond, Sapphire…) — color is never the sole signal. `gem-red` doubles as the only error/destructive color.

**The Gold-Not-Gray Rule.** There is no neutral gray in the system. Every "quiet" line, label, divider, disabled edge, and caption is a *gold* or *parchment* at reduced opacity, so it still reads as engraving or paper on the table rather than as generic UI gray.

## Typography

**Display Font:** Thmanyah Serif Display — the Arabic-native ceremonial serif from font.thmanyah.com, self-hosted via `next/font/local` (`src/app/fonts.ts`, weights 300/400/500/700/900). Falls back to Georgia (with Iowan Old Style, Palatino Linotype, Times New Roman, serif). Exposed as `--font-display` and the `.font-display` / `ornament-label` utilities.
**Body Font:** Thmanyah Sans, falling back to the system sans stack (ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial).
**Label Font:** Thmanyah Serif Display again, set as engraved small-caps (`ornament-label`).

> Both Thmanyah faces carry full Latin **and** Arabic glyph sets, so a single family serves LTR (English) and RTL (Arabic) — it replaces the former Cairo Arabic face. Below, "Georgia" is used as shorthand for the ceremonial serif face (now Thmanyah Serif Display).

**Character:** A ceremonial serif does all the titular and numeric "engraving" work (wordmark, prestige scores, section labels) while a plain system sans carries the running text of play. The serif is almost always warm gold and lifted with an engraved text-shadow; the sans is parchment on navy. The two never blur — serif = ceremony and number, sans = instruction.

### Hierarchy
- **Display / Wordmark** (Georgia, 700, `text-6xl`→`text-7xl` / 3.75–4.5rem, line-height 1, tracking `wide`): the "Splendor" lockup. Carries the engraved shadow: `text-shadow: 0 1px 0 rgba(255,255,255,0.14), 0 2px 22px rgba(217,180,91,0.28), 0 4px 3px rgba(3,7,18,0.6)` — a white top glint, a gold candle-bloom, and a dark drop, so the letters read as raised gilt. The in-game header uses a smaller `text-3xl` variant of the same treatment.
- **Title** (Georgia, 700, `text-2xl`/`text-xl`, gold-300): prestige scores on player panels, modal titles, "Game over".
- **Heading / Section** (Georgia, 600–bold, `text-sm` uppercase, tracking `widest`, gold-300 at ~80%): board section headings ("Nobles", "Bank").
- **Body** (system sans, 400, `text-sm`, line-height ~1.625, parchment): running instructions, resume text, log lines. Kept short; the lobby intro caps at `max-w-md`.
- **Label / Ornament** (`ornament-label`: Georgia, 600, 0.6875rem, uppercase, letter-spacing `0.22em`, gold-300 at 78%): the small-caps engraved section labels flanked by hairline rules ("New game"). Smaller inline meta labels use uppercase sans at `text-[10px]`, tracking `wide`, parchment at ~60%.

### Named Rules
**The Engraved-Serif Rule.** Any titular or single-number element (wordmark, prestige, modal title, section label) is set in the Georgia display face — and if it is hero-scale, it wears the three-layer engraved text-shadow (white glint + gold bloom + dark drop). Running sentences never use the serif.

## Layout

Two archetypes. **The lobby** is a single centered vertical stack (`min-h-screen`, `flex-col items-center justify-center`, `gap-7`): engraved wordmark, a gem-divider ornament (hairline–diamond–hairline), an intro line capped at `max-w-md`, then the raised form card at `max-w-md`. **The board** is a centered `max-w-7xl` container (`px-4 py-4`) with a bordered header (title + turn chip + lobby link), then a two-column grid: `grid-cols-1` stacking on small screens, expanding at `lg` to `lg:grid-cols-[1fr_320px]` — a fluid play area beside a fixed 320px sidebar (player panels + log). Column gap is `gap-6`. The play area splits into **two recessed `playfield` boards side by side**: a narrow **Nobles** board (its own border, holding the vertical noble column) and the main **Card Market + Bank** board (the market scrolls horizontally in a `py-3` well so hover-lifts aren't clipped, bank below). The sidebar sits directly on the table (for contrast against the sunken boards) stacking panels at `gap-3`. Section paddings are generous (`p-4`–`p-6`) so animated pieces don't overlap neighbors.

Spacing rhythm is a compact 0.25rem-based scale (Tailwind `0.5`–`6`): panel/card interior padding `p-2`–`p-3`, form padding `p-6`, modal padding `p-5`, gem/pip rows `gap-1`. The **ActionBar** is a `sticky bottom-3 z-30` tray, right-aligned (`lg:max-w-md`, full-width on mobile) so it occupies the empty space on the right during a turn without covering the board. Modals center over a `z-50` backdrop.

## Elevation & Depth

Depth is physical and warm: three shadow tiers simulate pieces of increasing height resting on the felt, each combining a tight contact/ambient shadow with a larger soft cast, all tinted toward the deep table color `rgba(3,7,18,·)` rather than neutral black. There is no flat/tonal layering — a raised element always casts. Interactive pieces *gain* height on hover (translate up + step to the next tier).

The full depth story runs **table → recessed board → raised pieces**. The shared play area is set into a **`playfield`** — a felt board *inlaid* (recessed) into the table, with a dark translucent `navy-950` fill, a `gold-700`-at-42% hairline edge, and an *inset* shadow (`inset 0 2px 12px rgba(3,7,18,0.55)`). It reads as sunk *into* the lit table, so the cards, tokens, and nobles raised on it (raise-1→2) sit believably in a socketed board. It is the one intentional *negative* elevation; everything else rises.

### Shadow Vocabulary
- **Raise 1 — resting on the felt** (`--shadow-raise-1`: `0 1px 2px rgba(3,7,18,0.45), 0 4px 10px rgba(3,7,18,0.3)`): default for board pieces — dev cards, card backs, noble tiles, inactive player panels, the log, deck badges, the final-round banner.
- **Raise 2 — the piece in play / lifted** (`--shadow-raise-2`: `0 2px 4px rgba(3,7,18,0.45), 0 10px 24px rgba(3,7,18,0.4)`): the hover-lift target for cards and nobles, the resume card, primary CTAs, and the base of the active-player breath.
- **Raise 3 — floating above the table** (`--shadow-raise-3`: `0 6px 14px rgba(3,7,18,0.5), 0 26px 60px rgba(3,7,18,0.55)`): dialogs/modals, the lobby form card, and the sticky ActionBar — the surfaces that leave the table plane.

### Named Rules
**The No-Halo Rule.** Depth and emphasis are expressed only through offset + blur cast shadows warmed to the table color. Symmetric ring-glows and colored halos are banned *as depth cues*. The two intentional glows in the system are candlelight, not shadow: the active player's `turn-breath` (a soft breathing gold cast) and the wordmark's engraved bloom.

**The Lift-On-Hover Rule.** An interactive piece (card, noble, deck) responds to hover by rising — `hover:-translate-y-1` — and stepping from `raise-1` to `raise-2`. Buttons press *in* on `active:translate-y-px`. Height change, not color change, is the primary hover signal.

## Shapes

Corners are consistently soft, sized by object weight. The signature radius is **`--radius-card` (0.7rem)**, applied via `rounded-card` to every framed game object (dev cards, card backs, noble tiles). UI surfaces use the Tailwind scale: `rounded-lg` (0.5rem) for panels/resume, `rounded-xl` (0.75rem) for the lobby form and modals, `rounded-md`/`rounded` for inputs and buttons, and `rounded-full` for token chips, gem pips, count badges, and the numbered player circles. Focus outlines round to 3px.

The defining border language is a **two-tier gold frame**:
- **`gold-frame`** — the ornate double line: a 1px `gold-700` outer border plus an inset box-shadow drawing a 2px `gold-500` inner rule and a soft 5px `gold-500`-at-28% outer wash, cornered to the card radius. Reserved for hero/framed objects: cards, card backs, noble tiles, active player panels, modals, the lobby/resume cards.
- **`gold-hairline`** — a single 1px `gold-500`-at-65% line for quieter elements: inactive panels, the log, chips, the reserved-mini frame, deck badges, the Pass button, numbered input circles.

Empty market slots use **`card-empty`** — a recessed setting (1px `gold-700`-at-34% edge + an `inset 0 2px 8px rgba(3,7,18,0.5)` shadow) at the card radius: an empty socket sunk into the board awaiting its card, rather than a dashed ghost.

## Components

### Buttons
- **Shape:** small radius (`rounded`, 0.25rem); compact.
- **Primary** (`Button variant="primary"`): solid `gold-500` fill, `navy-950` text, semibold. Sizes `md` (px-4 py-1.5) / `sm` / `xs` / `2xs` (px-2 py-0.5, `text-[10px]`).
- **Hover / Focus:** hover deepens fill to `gold-400`; global `:focus-visible` draws a 2px `gold-400` outline at 2px offset.
- **Ghost** (`variant="ghost"`): no fill — `parchment-300`-at-70% underlined text, hover to `parchment-100`. For low-emphasis actions (Clear, Discard).
- **Disabled:** `disabled:opacity-40`.
- **Full-width CTA (inline one-off, e.g. lobby "Start game"):** `gold-500`, `rounded-lg`, `py-3`, Georgia `text-lg`, `shadow-raise-2`, with a `from-white/25` top-sheen overlay for a minted/struck look; `active:translate-y-px`.
- **Outline "Pass" (inline one-off):** transparent with `gold-hairline`, parchment text, `hover:bg-navy-800`.

### Chips (Gem Tokens & Pips)
- **TokenChip** — the signature gem coin: a circular, gold-framed disc showing the gem's own photo (`GEM_ICON`, from `public/assets/Gems/`) via `<Art>` over a `GEM_VAR[color]` tint fallback. A center radial scrim (`rgba(0,0,0,0.5)` → transparent) keeps the white count legible over any gem, with a crown glint top-left. The circle frame is a 2px `gold-500`-at-72% ring, brightening to a 2px `gold-300` ring when the chip is selected or is the gold token; a `0 2px 6px rgba(3,7,18,0.55)` cast seats it on the felt. Sizes `sm`/`md`/`lg` (h-7/h-11/h-14). **States:** hover `scale-105`, selected `scale-110`, disabled `opacity-35`.
- **GemPip** — the flat counter disc (cost/bonus/token counts). Filled `GEM_VAR[color]` with a single `inset 0 0 0 1px rgba(0,0,0,0.4)` ring, matching light/dark text rule. Sizes `dot`/`xs`/`sm`; `round` or `square` (square = permanent bonuses on player panels); `dim` (opacity-20) marks a zero/absent bonus.

### Cards / Containers (DevCard)
- **Shape / Size:** `rounded-card` (0.7rem), fixed `h-36 w-24` (CARD_SIZE).
- **Face:** the `card-face` parchment gradient (`160deg`, `parchment-50`→`parchment-300`), wearing a `gold-frame`. A fixed, scattered subset of cards carries a real photographic `<Art>` layer (from `public/assets/Cards/`, assigned by a deterministic map in `lib/cardImages.ts`) beneath a top-and-bottom parchment scrim (`from-parchment-50/80 via-parchment-50/10 to-parchment-50/85`) so cost/points always read; the rest show the plain parchment face. Layout: Georgia points top-left, `GemPip` bonus top-right, `CostPips` bottom.
- **Back:** the `card-back` striped gradient (45° gold `0.09`-alpha repeating stripes over a `navy-700`→`navy-950` field) under a `gold-frame`; centers drawn gold deck pips (one per level) + optional small-caps label. Reserved minis use the finer-striped `card-back-mini`.
- **Shadow / States:** `shadow-raise-1` at rest; clickable cards `hover:-translate-y-1 hover:shadow-raise-2`. **Affordable** → a 2px `gold-400` ring. **Focused/peeked** → 2px `gold-300` outline. **Disabled** → `opacity-60`. Transitions run `duration-200 ease-out-expo`.

### Inputs / Fields
- **Style:** `gold-hairline` border, `navy-950/50` fill, `rounded-md`, `px-3 py-2.5`, `parchment-50` text; placeholder `parchment-300/60`. Preceded by a numbered `gold-hairline` circle.
- **Focus:** fill lifts to `navy-950/70` and a 2px `gold-400/80` ring appears (`focus:ring-2`); native outline suppressed in favor of the themed ring. Caret is `gold-400`.

### Modal
- **Shell:** fixed `z-50`, centered over a `bg-navy-950/70` `backdrop-blur-sm` scrim. Panel is `navy-800`, `gold-frame`, `rounded-xl`, `p-5`, `shadow-raise-3`, entering with `rise-in`, topped by a `via-gold-300/45` horizontal sheen line. Georgia `text-xl` gold-300 title.
- **A11y:** `role="dialog"`, `aria-modal`, `aria-labelledby`; on mount focuses the first focusable, runs a Tab focus-trap, closes on Escape and backdrop click (when dismissable), locks body scroll, and restores focus to the opener on close.

### Player Panel (signature)
- Rounded-lg surface with `shadow-raise-1`. **Active player** = `gold-frame` + `turn-breath` (the slow candlelit pulse) on a `navy-800/75` fill, with a "turn" chip; **inactive** = `gold-hairline` on `navy-900/40`. Header pairs a Georgia name with the **`prestige-seal`** — a struck-coin medallion (recessed `navy-950` fill, `gold-500`-at-60% rim, an inset top highlight) holding the Georgia gold-300 prestige number. Bonus row = five `square` GemPips (dimmed when zero); token row = round GemPips per held color. Reserved cards render as ~`h-20 w-14` minis: public board reserves show the face; a blind reserve shows `card-back-mini` with a lock and, for its owner only, a press-and-hold "hold to peek".

### Noble Tile (signature)
- Fixed `h-20 w-20` parchment tile (`155deg` `parchment-50`→`parchment-300`) with a `gold-frame`, an `<Art>` portrait under a top/bottom parchment scrim, a Georgia "**3**" (prestige) top-right, and the `CostPips` requirement bottom-left. **Selectable** (noble-choice dialog) adds a 2px `gold-300` ring + hover-lift to `raise-2`.

### Browser Surfaces
Themed so untouched chrome still reads as the world: `::selection` is `gold-400` on `navy-950`; scrollbars are thin, gold (`gold-700`→`gold-500` thumb on a translucent `navy-950` track); the text caret is `gold-400`; `:focus-visible` is the shared 2px `gold-400` outline.

## Do's and Don'ts

### Do:
- **Do** frame every hero game object (cards, nobles, active panel, modal) with `gold-frame` and drop quieter surfaces to `gold-hairline`. The two-tier gold border *is* the visual identity.
- **Do** convey depth only with the three warm cast-shadow tiers — `raise-1` for pieces on the felt, `raise-2` for the lifted/active piece, `raise-3` for dialogs and the sticky ActionBar — and make hover *lift* the piece a step (`hover:-translate-y-1`, `hover:shadow-raise-2`).
- **Do** set anything titular or numeric (wordmark, prestige, section labels) in the Georgia `--font-display` face, and give hero-scale type the three-layer engraved text-shadow.
- **Do** render every "quiet" line, label, and caption as gold or parchment at reduced opacity — never a neutral gray. Section labels use `ornament-label` small-caps.
- **Do** draw icons as inline SVG strokes (`stroke="currentColor"`, ~1.6px), matching the lobby add/remove marks.
- **Do** keep gem color paired with its text label (Diamond, Sapphire, Emerald, Ruby, Onyx, Gold) and use `gem-red` for errors — color alone never carries meaning.
- **Do** honor `prefers-reduced-motion` (the global guard neutralizes `rise-in`, `turn-breath`, and all transitions).

### Don't:
- **Don't** use ring-glows or colored halos as a depth or emphasis cue. The only glows allowed are candlelight: the wordmark bloom and the active player's `turn-breath`.
- **Don't** introduce neutral gray, or spend the six jewel colors on decoration/chrome — they belong to game pieces that mean that color, nothing else.
- **Don't** use emoji or icon-font glyphs in the chrome. (The lock "🔒" on a hidden reserve is the single deliberate exception, on a covered card back.)
- **Don't** add ambient or looping animation beyond the one authored `rise-in` settle and the single `turn-breath`. The only other motion is event-triggered and self-dismissing: the reward flourish (`celebrate-pop`/`-burst`/`-spark`) shown by `Celebrations` when a player wins a card or noble. Everything else stays instant.
- **Don't** put running sentences in the serif, or set ceremonial titles/numbers in the sans — keep the serif/ceremony vs. sans/instruction split clean.
- **Don't** ship a modal without its focus-trap, Escape-to-close, scroll-lock, and focus-restore; don't rely on hover-only affordances (mirror the press-and-hold peek with a visible label).
- **Don't** assume every card is illustrated — only a fixed, scattered subset carries real photographic art (`public/assets/Cards/`); the rest, plus any image that fails to load (via `<Art>`'s onError), must stay legible on the pure-CSS parchment `card-face`. Noble tiles are all illustrated (`public/assets/Nobels Itemes/`).
