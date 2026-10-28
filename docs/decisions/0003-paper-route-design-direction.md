# 0003: Paper Route design direction

- Date: 2026-10-28
- Status: Accepted (visual direction only; porting into `web/` not yet authorized)
- Owner: TODO

## Context

Decision 0002 asks for a light, legible interface that does not imitate
Canada.ca. Its workspace must show the form, the selected-field panel and the
chat together on desktop. We needed one visual direction before building the
real workspace.

## Options considered

Static prototypes in [design-explorations/](../../design-explorations/). Each
uses the same content and behaviour:

1. **Marginalia:** explanations as margin notes on an annotated paper form.
   Calm and very legible, but the notes compete for space on small screens.
2. **Transit:** the form as a route of stations, with a service map.
   Strong orientation, but dark sign panels and four line colours felt playful
   and loud.
3. **Facts Panel:** a ruled, bilingual "Field Facts" label. Dense, and
   intimidating for low-literacy readers.
4. **One Field at a Time:** a single large field at a time. The calmest
   option, but it hides the real form.
5. **Thread:** chat-first. Familiar, but field browsing is secondary.
6. **Paper Route:** Transit's layout drawn with Marginalia's materials.

The team first chose Marginalia. It then asked for a sixth direction that
"keeps the layout of 2 and embraces the simplicity of 1".

## Decision

Adopt **6 · Paper Route**. It keeps Transit's three-column workspace:

- the route of fields, with "You are here" and a "Next field" button
- page stops and the service map on the landing page

It renders them in Marginalia's language:

- a desk and paper surfaces in graphite ink
- Atkinson Hyperlegible Next as the only typeface
- a single highlighter-yellow accent
- dash patterns instead of coloured lines

The tokens, components and rules are in [DESIGN.md](../../DESIGN.md).
The reference prototype is
[06-paper-route.html](../../design-explorations/06-paper-route.html).

## Consequences

- Orientation and the "Next field" action are the product's main affordances.
  The yellow accent is reserved for them.
- At medium widths, three columns get dense. Below 1081px the layout stacks
  and the route scrolls horizontally, so test it on real devices.
- The service-map legend relies on dash patterns. Confirm it reads clearly
  for low-vision users.
- The prototype's French copy is a draft and needs review by a fluent speaker.
  Its form facsimile is illustrative, and its chat replies are canned.
- Porting into `web/` (Tailwind and shadcn/ui tokens) needs a separate
  request. The other prototypes remain for reference only.
