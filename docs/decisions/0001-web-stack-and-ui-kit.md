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
  `/api/explain`. A streaming LLM library (for example the Vercel AI SDK) and
  the LLM provider remain open and can replace those route handlers.

## Consequences

- Frontend and backend share TypeScript types (`FormField`, `Resource`).
- Python-based scraping or retrieval from the LLM team would run as an offline
  step producing JSON, or as a separate service if needed.
- Once accepted, update [README.md](../../README.md) with verified setup and
  validation commands.
