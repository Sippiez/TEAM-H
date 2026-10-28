# 0001: Web stack and UI kit

- Date: 2026-10-28
- Status: Accepted (approved by the team to build the MVP UI)
- Owner: TODO

## Context

The team asked for a shadcn/ui design for the Government Form Helper MVP (see
[MVP design](../mvp-design.md)). shadcn/ui is a React and Tailwind CSS component
collection, so choosing it constrains the frontend stack. The MVP also needs PDF
rendering with clickable field overlays and streaming chat.

## Options considered

- **Next.js (App Router) + TypeScript + Tailwind + shadcn/ui**: one project for
  UI and API route handlers; first-class shadcn support; easy deployment.
- **Vite + React + shadcn/ui with a separate API (for example FastAPI)**:
  lets the LLM team work in Python, but adds a second service and CORS setup.
- **Non-React UI kit**: does not satisfy the shadcn requirement.

## Decision

Accepted: Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui, in
the `web/` folder. Implementation notes:

- shadcn uses the `base-nova` style, which is built on Base UI
  (`@base-ui/react`) rather than Radix. Compose components with the `render`
  prop instead of `asChild`.
- `pdfjs-dist` renders pages and reads AcroForm field metadata in the browser.
  `scripts/copy-pdf-worker.mjs` copies its worker into `public/` before
  `dev` and `build`.
- Chat currently uses a rule-based assistant behind `/api/chat` and
  `/api/explain`. This is prototype behavior, not the accepted live-AI outcome.
  [Decision 0002](0002-government-form-helper-mvp.md) records the agreed MVP and
  prefers the documented, organization-approved Copilot SDK route, subject to
  access, data-handling, spending, and feasibility gates. It does not authorize
  implementation or dependency installation.

## Consequences

- Frontend and backend share TypeScript types (`FormField`, `Resource`).
- Python-based scraping or retrieval from the LLM team would run as an offline
  step producing JSON. Decision 0002 selects Next.js for source lookup and AI
  requests without a separate Python backend.
- Once accepted, update [README.md](../../README.md) with verified setup and
  validation commands.
