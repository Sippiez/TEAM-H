# Plan: Issue #15 — Instant field highlight with attention animation

## Problem and approach

Issue #15 requires field selection feedback within 200 ms, a short attention
pulse after the selected field is in view, reduced-motion support, and an
assistive-technology announcement. The existing app routes PDF overlay, field
list, and chat-reference selections through one `selectField` callback, sets
the selected field and page immediately, and shows explanation skeletons while
data is loading. Keep that shared flow and improve it rather than adding a
parallel selection mechanism.

Use the existing Tailwind CSS v4 setup and app stylesheet for the pulse; do not
add dependencies or introduce another styling framework. Trigger the pulse only
after the target overlay is rendered and brought into view. Honor reduced-motion
preferences for the pulse and selection-driven scrolling. Add a polite status
announcement for the selected field and loading state, and preserve the current
panel, selection, and explanation behavior.

## Scope and likely files

- `web/src/components/form-helper/form-helper-app.tsx`: retain one selection
  path for all three entry points; expose selection/loading status accessibly.
- `web/src/components/form-helper/pdf-page.tsx`: coordinate target visibility
  and pulse timing when the selected page/overlay is ready.
- `web/src/components/form-helper/field-panel.tsx`: ensure the existing
  explanation skeleton is a meaningful loading status for assistive technology.
- `web/src/app/globals.css`: define the brief pulse and disable it under
  `prefers-reduced-motion`.

## Todos

1. Trace and refine the shared selection feedback for PDF overlays, field-list
   controls, and chat references while preserving immediate selected-field and
   loading feedback.
2. Add a destination pulse that starts after the field is in view, with reduced
   motion honored for both animation and scrolling.
3. Announce the selected field and explanation loading state, then verify the
   acceptance criteria and run the documented typecheck and lint commands.

## Notes and validation

- The acceptance target comes from issue #15 and ADR 0002: selected-field
  highlight and loading feedback within 200 ms.
- Use the issue's three selection sources as scope, as confirmed by the user.
- No automated tests currently exist. Validate the interaction in the app,
  including reduced-motion and assistive-technology status behavior, then run
  `npm run typecheck` and `npm run lint` from `web/`.
- The current branch is `feature/instant-field-highlight`; the worktree was
  clean at planning time.
