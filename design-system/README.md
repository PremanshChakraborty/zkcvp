# ZKCVP Design System

Design tokens, a plain-CSS component layer, and React (TSX) components for the ZKCVP
app. No pages — this is the vocabulary the pages will be built from.

**Direction:** forensic and precise. Dense layouts, hairline borders carrying the
structure instead of shadows, sharp radii, monospace for every identifier a person
might paste into a terminal, and a status palette bound directly to the domain enums.
Dark-first; light fully supported.

**Colour, font family and spacing are ported from the Claude Design project
"ZKCVP Design System"** (`tokens/colors.css`, `tokens/fonts.css`, `tokens/spacing.css`).
Type scale, radii, elevation, motion and control heights are this system's own and were
kept deliberately — the source project mixes several type sizes per surface, and a single
numeric scale reads more consistently.

## Layout

```
design-system/
├── styles/
│   ├── design-system.css   ← single entry point; import this
│   ├── fonts.css           ← IBM Plex Sans + Mono (@import; swap for next/font)
│   ├── tokens.css          ← every colour/size/duration value in the system
│   ├── base.css            ← reset, document defaults, typography, layout helpers
│   ├── components.css      ← generic UI
│   ├── domain.css          ← ZKCVP-specific UI
│   └── responsive.css      ← breakpoints + pointer/hover modality; loads last
├── components/             ← React wrappers over the CSS above
│   ├── index.ts            ← import from here, never from individual files
│   └── types.ts            ← domain enums + their human labels
└── previews/               ← static HTML specimen pages (Claude Design)
```

## Usage

```tsx
// once, in the root layout
import "@/design-system/styles/design-system.css";

import { RequirementRow, VerdictCard, Button } from "@/design-system/components";
```

The CSS is framework-free — no Tailwind, no build step, no runtime. React components
are thin wrappers that pick class names; anything they can do, hand-written markup
with the same classes can do too. That is deliberate: the preview pages in
`previews/` use the real stylesheet, so what you see there is what ships.

### Path alias

The app does not exist yet. When it is scaffolded, add to `tsconfig.json`:

```json
{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }
```

Components that use state or events carry `"use client"` already.

## Token rules

1. **No raw hex outside `tokens.css`.** Component CSS reads custom properties only.
2. **Two accent values, not one.** `--ds-color-accent` is for text and icons;
   `--ds-color-accent-solid` is for filled backgrounds. One value cannot clear 4.5:1
   in both roles. Amber fills take **near-black** text (`--ds-color-on-accent`), never
   white — white on amber fails at any size.
3. **The type scale is numeric** (`--ds-text-100` … `--ds-text-700`), so "is 400
   bigger than 300" is never a question. 300 is the default UI size. 400 is the
   reading size and appears only where there are real sentences — evaluator
   rationales and requirement descriptions.
4. **Space is the source project's 4px scale**: 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64,
   plus its density contexts (`--ds-row-dense` 36px for commit lists and tables,
   `--ds-row-comfy` 48px for checklist rows).
5. **Width and input modality are separate questions.** The system is authored
   desktop-dense-first, because that is the real usage scene. `responsive.css` adapts
   it downward at 960px and 640px, and handles `pointer: coarse` and `hover: none`
   *independently* of width — a touch laptop is wide and coarse, a landscape phone is
   narrow with no hover. Conflating them is what leaves affordances unreachable.
6. **Loading indicators slow under reduced motion; they never stop.** Freezing a
   spinner or the indeterminate bar makes a request that is genuinely still running
   look hung, which misinforms rather than accommodates. Purely decorative motion
   (the skeleton shimmer) stops outright.
7. **Surfaces invert for evidence.** `--ds-color-surface-inset` is *darker* than the
   canvas. Cards sit above the page and hold chrome; wells are cut into it and hold
   evidence. Keeping those visually opposed is what makes "this is data the system
   actually read" legible.

## Domain rules the components encode

These are not styling preferences. Each one exists because the alternative would
show a user something false.

### `eval_failed` means "not satisfied", not "something broke"

Per `docs/plans/01-requirement-management.md`, the transition table maps a satisfied
verdict to `verified` and a **not-satisfied verdict** to `eval_failed`. The column
name reads like an error; it is not one.

- `StatusBadge` renders it as **"Not satisfied"**. The raw enum name never reaches a
  screen — `REQUIREMENT_STATUS_LABEL` in `types.ts` is the only place the mapping lives.
- Genuine infrastructure failures (GitHub rate limit, evaluator crash, blown
  execution ceiling) use `SystemErrorBadge` and `Alert tone="danger"` — **coral, never
  periwinkle**. They say nothing about whether the code satisfies the requirement, and
  colouring them like a verdict would tell the developer something untrue.

### One colour, one meaning

The palette keeps five jobs strictly apart. The middle two are the ones that get
conflated in most tools, and conflating them here would misinform a developer about
their own code:

| Token | Hue | Means |
|---|---|---|
| `--ds-color-accent` | amber | Interactive only — actions, links, focus, active nav |
| `--ds-color-success` | teal | `verified` / verdict `satisfied` |
| `--ds-color-verdict-failed` | periwinkle | `eval_failed` / verdict `not_satisfied` — a real result |
| `--ds-color-danger` | coral | True errors and irreversible destructive actions |
| `--ds-color-neutral` | slate | `new` — never evaluated |

`--ds-color-warning` is an **alias of the accent**, not a sixth hue: this palette has
exactly one attention colour. That is safe only because amber is not a verdict colour,
so an amber "approaching the request time limit" clock cannot be read as a result.
Anything that has actually failed uses `danger`.

Role identity (`--ds-color-role-stakeholder` blue, `--ds-color-role-developer` slate)
sits outside all of it — who someone is must never be confused with what an evaluation
concluded.

### `new` is neutral, not amber

Never having been evaluated is an absence of information, not a caution.

### `archived` is not a status

`requirements.archived_at` and `requirement_versions.status` are orthogonal — a
requirement can be archived whatever its verification history, and archiving says
nothing about whether it was ever verified. `RequirementDisplayStatus` folds the two
together **for display only**, because a row shows one badge at a time. Never persist
that type.

### Effective status is always derived

The status a row displays is its *current version's* status, resolved through
`requirements.current_version_id` at read time. Plan 01 forbids storing it on the
requirement; components take it as a prop and assume it came from a join.

### Sealed is not unverifiable

`EvidenceLock` withholds the bundle's contents **and keeps the verify action live.**
Checking that evidence was never altered and disclosing what it says are separate
operations, and the first never requires the second. Removing the verify button
because the bundle is private would collapse the distinction the trust model rests on.

### Rationales are prose, never code

The Evaluator is constrained at generation time never to emit verbatim source; it may
cite a path or a line range, which is what `FileRef` is for. `VerdictCard` styles the
rationale as prose so a leak would render as visibly wrong. **That is a weak free
signal, not a filter** — filtering code out of already-generated text is unreliable,
which is why the constraint lives in the agent's output step instead.

### Never fake a progress percentage

Evaluation runs synchronously inside the request that submits the claim, so the
developer's own tab is held open for its full duration. `EvaluationProgress` uses an
indeterminate bar — there is no honest fraction for an LLM evaluation — and turns the
elapsed clock amber past 70% of `ceilingSeconds`, so the developer is warned *before*
the request is cut off rather than after.

### The undo window is the whole reversible window

Repo attachment is permanent once the 60-second window closes: plan 02 has no detach
endpoint and no soft-delete state. `UndoToast` shows a live countdown ring because the
remaining time has to be legible at a glance, not inferred from a fading toast.

### Truncate hashes in the middle

Comparing a digest by eye means comparing head *and* tail. `HashRef` clips the middle;
a trailing ellipsis would destroy the only affordance that matters. Full values stay
in `title` and in the copy payload.

## Accessibility

- One focus treatment everywhere: 2px solid accent ring, 2px offset, keyboard-only via
  `:focus-visible`.
- Status is never colour alone — every badge pairs its tone with a text label, and the
  dot-only variant carries `aria-label` plus `title`.
- Text tones are contrast-checked against their own surfaces in both themes; the
  accent splits into two values for exactly this reason.
- All motion collapses to `0ms` under `prefers-reduced-motion`; the shimmer stops and
  spinners slow rather than vanish.
- Wide content scrolls inside `.ds-scroll-x`; the page body never scrolls sideways.

## Previews

`previews/*.html` are specimen pages using the real stylesheet. Open
`previews/index.html` directly in a browser — no server or build needed — or sync the
directory to Claude Design. Each page carries a first-line `@dsCard` marker naming its
group.

The `pv-` prefixed styles in `previews/preview.css` are harness chrome only and are
not part of the system. Nothing in that file should be copied into the app.

## Not built yet

Deliberately absent until there is a page that needs them, so their API is shaped by a
real caller rather than guessed: modal/dialog, dropdown menu, date picker, pagination,
command palette, and the repo/branch picker composite for the attach flow.
