---
name: Form Helper
description: Understand a government form, one field at a time.
colors:
  desk: "#f3f5f7"
  paper: "#ffffff"
  ink: "#22262b"
  ink-2: "#4a525c"
  rule: "#cdd3da"
  rule-2: "#e3e7ec"
  control-stroke: "#6b7480"
  quiet-stroke: "#8a939d"
  hover-wash: "#e6eaee"
  highlighter: "#ffe94d"
  highlighter-deep: "#ffdf1a"
  highlighter-ink: "#8a6e00"
  status-wash: "#fffbe0"
  pencil: "#2556a6"
typography:
  display:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "clamp(2.15rem, 3vw, 2.9rem)"
    fontWeight: 800
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
    lineHeight: 1.2
  body:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.35
  marker:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 700
    letterSpacing: "0.04em"
rounded:
  field: "2px"
  sm: "4px"
  md: "6px"
  bubble: "10px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button-primary:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 14px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "{colors.highlighter-deep}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "44px"
  button-secondary-hover:
    backgroundColor: "{colors.highlighter}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "48px"
  chip:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
    height: "40px"
  station-current:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  page-stop:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.pill}"
    size: "30px"
  page-stop-current:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.ink}"
    size: "36px"
  context-chip:
    backgroundColor: "{colors.highlighter}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
---

# Design System: Form Helper

The workspace reference implementation is
[design-explorations/06-paper-route.html](design-explorations/06-paper-route.html),
chosen in [decision 0003](docs/decisions/0003-paper-route-design-direction.md).
The production implementation is in [web/](web/): tokens and `.pr-*`
component classes in `web/src/app/globals.css`, and components in
`web/src/components/form-helper/`. When this file and the prototype or app
disagree, this file wins. Update it when the direction changes.

The landing page follows **direction 1, Marginalia**:
`design-explorations/01-marginalia.html`. Its scoped `.marginalia-*` classes,
`landing.tsx`, and `marginalia-preview.tsx` use the same paper, graphite,
highlighter and typography family as the workspace. The landing-specific
composition below takes precedence over the original Paper Route landing.

## Overview

**Creative North Star: "Paper Route"**

A route map, drawn in pencil on a clean study copy of the form. The layout
comes from wayfinding: a line of fields, with each field as a station, a
"You are here" marker, and a clear next stop. The materials come from an
annotated paper form: a cool desk, white sheets, graphite ink and one
highlighter. People should always know where they are, what comes next, and
where the official answer lives. Nothing should feel loud.

The product is an Operate surface for people who may be anxious, reading in a
second language, or helping someone else. Calm and orientation come before
expression. All personality is in the details: the highlighter swipe on the
selected field, the pencil-drawn route, and dash patterns used instead of
colour-coded lines.

Light only. It is not a Government of Canada service and must not look like
Canada.ca ([decision 0002](docs/decisions/0002-government-form-helper-mvp.md)).

**Key characteristics:**

- Three columns on desktop: route of fields, form sheet, then the field panel or chat.
- Graphite on paper, with exactly one accent: highlighter yellow.
- Lines are told apart by dash pattern, not hue.
- Large, legible type (17px body) in a typeface designed for low-vision readers.
- Paper depth: sheets cast soft shadows on the desk. There are no dark panels.

## Colors

The palette is grey paper and graphite, with one highlighter used only for
location, the next action and selection.

### Primary

- **Highlighter** (#ffe94d): Marks "you are here" and the next step: the
  current station, the current page stop, the selected form field, the
  "Asking about…" context chip, and primary actions (Next field, Send, Open
  sample). Never use it for decoration.
- **Highlighter Deep** (#ffdf1a): The hover state of highlighter buttons.
- **Highlighter Ink** (#8a6e00): The inset ring on a selected form field, so
  the selection reads on white without relying on the fill alone.

### Secondary

- **Pencil Blue** (#2556a6): Links only, for official sources and service-map
  stops. It is always underlined. Never use it for buttons or fills.

### Neutral

- **Graphite Ink** (#22262b): Text, route lines, station dots, borders of
  primary controls, and the focus outline.
- **Soft Graphite** (#4a525c): Secondary text, metadata, section labels and
  inactive tabs.
- **Desk** (#f3f5f7): The page background and route column.
- **Paper** (#ffffff): Sheets, panels and controls.
- **Rule** (#cdd3da) and **Faint Rule** (#e3e7ec): Column dividers and in-panel
  separators.
- **Control Stroke** (#6b7480): Text inputs and the dashed "Add PDF" button.
- **Quiet Stroke** (#8a939d): Secondary buttons, suggestion chips and the
  dashed drop zone.
- **Hover Wash** (#e6eaee): Hover state for stations and inactive document tabs.
- **Status Wash** (#fffbe0): Inline status and confirmation messages.

### Named Rules

**The One Highlighter Rule.** Yellow means "you are here" or "do this next".
If two things on screen are yellow, one of them is the current location and
the other is the next action. Never more.

**The Dash, Not Hue Rule.** Categories such as service lines use solid,
dashed (`10 7`) and dotted (`1 7`) ink strokes, plus a legend. Never add hues
for categories.

## Typography

**Font:** Atkinson Hyperlegible Next (fallback Atkinson Hyperlegible,
system-ui, sans-serif). Use a single family throughout.

**Character:** Plain, open letterforms designed to tell apart easily confused
characters (I/l/1, O/0), which matters for passport numbers and dates.
Hierarchy comes from weight (800 for headings, 700 for labels), not from a
second typeface.

### Hierarchy

- **Display** (800, clamp(2.15rem, 3vw, 2.9rem), 1.08, −0.02em): The landing headline only.
- **Headline** (800, 27px; 23px on phones, 1.2): The selected field's name in the
  side panel, wrapped in the highlighter mark.
- **Title** (800, 17–19px, 1.2): Card and section headings (Start here,
  Service map, Fields on this form).
- **Body** (400, 17px, 1.55): Explanations and chat. Lede text is 19px. Keep
  line length at or below 42–80ch.
- **Label** (700, 15–15.5px, 1.35): Station names, buttons, tabs and metadata.
- **Marker** (700, 13px, 0.04em, uppercase): Only for "YOU ARE HERE".

Use tabular figures (`font-variant-numeric: tabular-nums`) for page numbers,
counts and example values.

## Layout

- **Header:** a 60px desk-coloured bar with the brand, the
  "Independent tool. Not a Government of Canada service." notice, and the
  language toggle (left of New session, showing the other language's name
  with a matching `lang`). Below 640px, New session is icon-only, so the
  brand, toggle and button fit on one row.
- **Landing (Marginalia):** a maximum width of 1440px in a 2fr / 1fr grid
  with a 56px gap. An illustrative passport sheet and three margin notes
  sit on the left; the hero, folded-paper upload control, working sample
  and privacy notes sit on the right. Leader lines attach to the measured
  field edges and note headings, not fixed SVG coordinates. Only date of
  birth is selected; the three explained fields carry visited checks.
  At 1180px, the right column is 340px and the gaps narrow. At 1100px or
  below, the upload column comes first, followed by the study copy.
  At 860px or below, notes stack below the paper and connectors disappear.
  The service directory uses pencil-blue links, dotted leaders and department
  abbreviations, with keyword search. The existing service navigator remains
  available in an expandable section below it.
- **Landing facsimile:** 10.5px type (8.5px on phones), 1.45em title and
  `#5d6670` form rules reproduce concept 1's document, not interactive form
  controls. Margin-note headings use 18px; source links and department labels
  use 16px. The upload title is 22px and its folded corner uses `#dfe4e9`.
  The landing display uses `clamp(2.1rem, 2.9vw, 2.85rem)` and the directory
  heading uses 28px (24px on phones).
  These are scoped reference-design exceptions, not workspace token changes.
  Unlike the prototype, production offers only the bundled English PPTC 153
  and retains the actual 10 MB limit, local-PDF privacy statement and
  rule-based assistant disclosure. It does not claim the French sample or
  AI integration exists.
- **Workspace at 1081px and above:** height-locked resizable columns, initially
  `300px | remaining space | 456px`, with two 8px drag dividers. Each column
  scrolls independently. The fields panel has a 220px minimum and a 35% maximum;
  the details panel has a 300px minimum and a 50% maximum. The document keeps
  at least 280px. Dividers support dragging, keyboard arrow keys, and
  double-click to restore the adjacent panel's default size.
  - Left: the vertical route of fields, grouped by form section.
  - Centre: a sticky document bar, then the form sheet, at most 780px wide.
    The bar is one card with two rows: document tabs, then "N of 5
    documents" and Add PDF on the right; below a rule, "Page N of M" and
    the page stops. Tabs shrink and truncate the file name before the row
    scrolls. Below a 34rem card width, the count and Add PDF wrap under
    the tabs.
  - Zoom and Outline fields live in a small paper toolbar (card border,
    sheet shadow) that floats at the bottom of the sheet and stays in view
    while it scrolls, with an 8px sticky inset and 12px bottom padding. The sheet
    ends with an 8px gap before the toolbar and no extra spacer below it.
    Workspace scrollbars are hidden without disabling scrolling, except for
    the document's horizontal scrollbar so zoomed pages can be panned by dragging.
    Its paper background is
    80% opaque at rest and becomes solid on hover or focus within, over 150ms.
    Text and icons stay fully opaque. Reduced motion removes the transition.
    It comes before the sheet in focus order.
    The tabs/pages bar uses the same translucent paper and hover/focus treatment.
    Zoom preserves the document point at the centre of the visible reading area
    instead of anchoring to a corner or repeating a previous field-navigation scroll.
    Horizontal document panning keeps the zoom toolbar centred in the visible
    panel, rather than scrolling it out of reach with the sheet.
  - Right: Field and Ask tabs. The heading's highlighter mark sweeps left to
    right over 450ms when the selected field changes, without hiding or moving
    the text. Reduced motion shows the complete mark immediately. The Next
    button keeps its label on one line and ellipsizes when needed; its full
    label remains available to assistive technology and in its hover title.
- **1080px and below:** the columns stack. The route becomes a horizontally
  scrolling line of 136px stations above the document.
- **640px and below:** phone padding (14–16px), the notice wraps under the
  brand, the Previous/Next buttons stack, and the sheet type shrinks to 10.5px
  while form fields keep a 44px minimum height.
- **Rhythm:** 4/8/16/24/40px. Panels use 24px horizontal padding (16px on
  phones), with 24px between explanation blocks.

## Elevation & Depth

Depth is physical. Paper sits on the desk, nothing floats over it, and the
only dark surface is the form's own section bars.

- **Sheet** (`0 1px 2px rgb(34 38 43 / 0.10), 8px 14px 28px -10px rgb(34 38 43 / 0.30)`):
  The form sheet and the "Start here" card.
- **Card** (`0 1px 1px rgb(34 38 43 / 0.08), 3px 5px 12px -6px rgb(34 38 43 / 0.30)`):
  The document bar, service map and sample board.
- **Marker** (`0 0 0 3px #ffe94d, 0 2px 6px 3px rgb(34 38 43 / 0.25)`): Only the
  moving "You are here" dot.

## Shapes

Mostly square paper. Fields use a 2px radius. Tags and small surfaces use 4px,
and buttons and inputs use 6px. Circles are reserved for route and page
stations, the "You are here" dot and the selected-field corner dot. Pills are
reserved for chat chips and references. Strokes are 1.5px ink on controls and
2px ink on route lines; dashed strokes mean "add" or "drop here".

## Components

### Buttons

- **Primary:** highlighter fill, a 1.5px ink border, a 6px radius, a 48px
  minimum height and bold ink text with a trailing arrow. Use one per region.
- **Secondary:** paper fill with a 1.5px ink border; hover adds the highlighter
  fill (language toggle) or the hover wash (Previous).
- **Add / Drop:** transparent, with a 1.5px dashed control-stroke border.
- **Disabled:** 45% opacity with a not-allowed cursor.
- **Focus:** a 3px ink outline with a 2px offset on every control.

### Chips

- **Suggestion:** a paper pill with a 1px quiet-stroke border and a 40px height.
- **Reference (chat to field):** a paper pill with a 1.5px ink border and a
  small station dot. Choosing it navigates to the field.
- **Context ("Asking about…"):** a highlighter block with a paper Clear button.

### Cards / Containers

Paper on the desk with Card or Sheet shadows and no borders. Inner rows use
faint-rule separators. The side panel is flat paper with a rule on its left
edge.

### Inputs / Fields

- **Text input:** paper fill, a 1.5px control-stroke border, a 6px radius and
  a 48px height.
- **Form overlay field:**
  - Hover adds a 30% highlighter wash.
  - Selection animates a highlighter swipe (`fh-swipe`, left to right), adds a
    2px highlighter-ink inset ring and a 16px yellow corner dot with an ink
    border.
  - A visited field shows a small ink check.

### Navigation

- **Route (signature):**
  - A 2px ink line, with stations as 14px paper dots outlined in 2px ink;
    visited stations are filled ink.
  - The current station gets a highlighter background, bold label and the
    "YOU ARE HERE" marker.
  - A 20px yellow dot with an ink border travels along the line, animated over
    300ms with `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Page stops:** numbered circles joined by an ink line; the current page is
  larger and yellow.
- **Document tabs:**
  - The active tab is paper with an ink border and a 3px highlighter underline.
  - Inactive tabs use the hover wash.
- **Side tabs:** the selected tab has a 3px ink underline.

### Toasts

- Toasts sit top-centre, just below the header. They are used for problems
  only (wrong file, file too large, document limit, already open, no fields).
  A successful open shows no toast.
- Toasts are paper cards with a rule border, the Card shadow and a 6px radius.
  Errors and warnings use the Status Wash fill.
- Each toast has a bold 15.5px ink title, a 15px ink-2 description and a 20px
  ink icon. Toasts are always light themed.

### Service map (signature)

An ink route diagram on the landing page. Stops are paper dots, and
interchanges are double rings. Labels are underlined pencil-blue links to
official pages. Lines are told apart only by dash pattern, with a legend.

## Do's and Don'ts

### Do:

- **Do** keep the route, the form and the explanation visible together on
  desktop, so people can always see where they are.
- **Do** use highlighter yellow only for the current location, the selection
  and the single next action.
- **Do** keep touch targets at least 44px and text at least 15px outside the
  form facsimile.
- **Do** honour `prefers-reduced-motion`: there is no marker travel and no
  highlighter swipe.
- **Do** label official sources and keep the independence notice in the header.

### Don't:

- **Don't** use dark sign panels, coloured transit lines or a second accent
  colour. Those belonged to direction 2's look, which was not chosen.
- **Don't** imitate Canada.ca, use the Government of Canada wordmark, or add a
  dark theme.
- **Don't** add decorative icon tiles, gradients or glass effects. Icons are
  plain 1.15em ink glyphs.
- **Don't** use pencil blue for anything but links.
