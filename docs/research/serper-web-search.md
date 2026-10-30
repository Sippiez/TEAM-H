# Serper migration evidence

## Provider findings

- [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
  distinguish project-level model limits from built-in tool limits. The
  documentation currently describes a default 1,500 grounding requests/day
  per project for Gemini 3 and newer. Actual active limits depend on the
  project, model and account; this is not a verified allowance for this account.
- [Google Search grounding](https://ai.google.dev/gemini-api/docs/google-search)
  can generate multiple queries per request. Changing an SDK does not remove
  provider quotas. A 429 alone does not establish the exact exhausted metric
  or numeric allowance.
- A fresh paired request using the configured model/key returned:
  `search=false: OK`; `search=true: HTTP 429, RESOURCE_EXHAUSTED`.
  This reproduces the search-enabled failure separately from working ordinary
  generation. Only sanitized status flags were captured.
- [Serper](https://serper.dev) returns organic results with `link`, `title`
  and `snippet`. A live POST to `https://google.serper.dev/search` with
  `X-API-KEY`, `q`, `gl: ca`, `hl: en`, and `num: 5` returned HTTP 200 and
  five organic results using the key the user stored in `web/.env`.
  The key and raw response were not logged.
- The live Ontario query exposed HTTP canonical URLs in otherwise valid organic
  results. The adapter now upgrades those URLs to HTTPS before the unchanged
  official URL policy runs; it never fetches HTTP, unwraps Google redirects or
  admits lookalike domains/nonstandard ports. A regression reproduced
  `no_allowed_candidates` before this change and passes afterward.

## Verification scope

Offline regression coverage exercises the real adapter and lookup coordinator:
server-only request shape, canonical public terms, language, candidate and
response limits, missing/invalid credentials, quota, cancellation, direct-first
ordering, no duplicate search, official-domain/jurisdiction rejection, and no
answers from snippets when page retrieval fails. Chat integration coverage
checks that the default path uses Serper, not model-generated URLs or Google's
built-in search, and synthesizes only verified excerpts.

- A real `/api/chat` Ontario health-card application question completed with
  `verified / search`, three `live_official` sources, 1,666 answer characters
  and a complete stream. This exercises Serper discovery, HTTPS page retrieval
  and ordinary Gemini synthesis together.
- The original Saskatchewan Student Aid download case (`154091`) completed with
  `verified / official_page`, one source and a complete answer. Direct
  verification succeeded on this connection, so no search fallback was needed.
- The final targeted search/chat/UI suite passed 144 tests. Type checking and
  linting of all changed application/test files passed.
- The broader suite exposed two existing landing-page assertions expecting a
  privacy `<details>` element inside the features section. Both also fail with
  the unchanged baseline translations. The landing markup was not modified.
- `web/.env` is ignored by Git. No credentials were changed or copied into
  tracked files. The temporary live-check server was stopped after verification.

Serper has its own credits and rate limits. Search success is not proof that
official pages can be retrieved on this network; the earlier TLS-inspection
failure remains a separate limitation. No TLS bypass is introduced.

Decision: [0008](../decisions/0008-serper-web-search.md).
