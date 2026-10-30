# 0006: Google Search grounding

- Status: Accepted; direct-first lookup with Google fallback, with successful live grounding blocked by project quota
- Supersedes: [0005](0005-restricted-official-search.md)
- Amended by: [0007](0007-automatic-public-form-discovery.md) for unregistered
  public-form discovery and removal of the service dropdown.

## Context

The user requested "ok switch to google search grounding" after the Saskatchewan
Student Aid page failed local TLS verification. The local certificate chain was
issued by a TLS-inspecting proxy. Changing the AI SDK alone would not fix the
trust store; no certificate verification was disabled or unapproved CA installed.
The user then requested the previous method first and Google only if it fails,
and clarified that "use my data" means a mobile-data/hotspot connection, not a
local-data-only privacy mode. This updated order is the active decision.

## Decision

Restore direct official-page lookup as the first attempt. Recognized downloads
use their fixed official information page; mapped services work without a Brave
key, while a configured Brave adapter enables broader candidate discovery.
Preserve the hardened DNS/IP/pinned-HTTPS/redirect/content policy and Gemini
synthesis from verified excerpts. A successful direct lookup never calls
Google Search, including when it has a usable partial set of sources.

If the direct attempt is unavailable or has no verified result, use the existing
server-side `@google/genai` client/model with `tools: [{ googleSearch: {} }]`.
Do not invoke fallback for invalid/ambiguous selection or parent cancellation.
Retain the initial failure as `fallbackReason`, including if Google also fails.
No dependency, model, certificate or billing change is made; grounding access
and sufficient quota remain external requirements.

Keep the finite service/form/facet/jurisdiction catalog and clarification flow.
The search-enabled request receives only catalog terms, jurisdiction, interface
language and registered public form references/pages. Neither original chat
wording/history nor filenames, field metadata, PDF bytes or entered values are
sent to this request. Google generates the actual search queries.

Require completed generation, actual web-search queries, citation chunks,
grounding supports and Google Search Suggestions. Insert numbered citations using
the provider's UTF-8 byte offsets, including multipart responses. Show the
Google-grounded answer directly, preserve the provider citation links and display its
Search Suggestions in a sandboxed frame without script/same-origin permissions.
Do not silently remove bad sources or rewrite a Google-grounded answer with
another model. Directly fetched excerpts still use their original, separate
answer-synthesis path.

Enforce the existing fourteen approved official content roots and selected
jurisdiction on every returned source. A `site:` prompt is not a hard provider
allowlist. Reject the entire answer if any citation is outside policy. Google
redirect-wrapped citations are resolved only by a manual HEAD to the exact
Google gateway; the application never follows that redirect to the official
page. Google is not an approved content root.

Label sources as Google-grounded with search time, not independently fetched,
reviewed or necessarily current. Do not infer source language from response
language. Keep saved official navigation separately labeled. Missing grounding,
blocked citations, quota exhaustion and provider failure produce explicit
lookup states, never answers from memory. Saved guidance is not substituted
for either retrieval method.

The 30-second chat deadline remains. Direct lookup has a 10-second sub-budget;
its timeout does not abort the parent's signal needed for fallback.
Grounding has a cancellable 20-second
sub-budget, including redirect resolution, with at most eight source entries
and bounded answer/support/suggestions sizes. Cancellation returns even if a
provider or resolver fails to settle after its signal is aborted.

## Consequences

- Direct lookup still requires valid official-page TLS chains. Switching to
  mobile data may bypass the observed proxy, but the app does not change the
  user's network or weaken TLS. If direct lookup fails, Google handles content
  retrieval for fallback; connections to Gemini and the citation gateway still
  require valid TLS.
- Google retains grounding requests/context/output for 30 days. Deployment
  needs a data-handling, quota, pricing and terms review. Multiple Google-generated
  searches may incur charges; do not promise one search per question.
- Direct pages retain archive/relevance checks and excluded-download warnings.
  Google-grounded pages do not receive those independent content checks.
  Approved domains alone do not prove freshness or factual accuracy.
- Saskatchewan's 2026-27 full-time Student Aid application is recognized locally
  by its public title/product reference `154091`; its public registry includes
  the fixed official information page. Other years and part-time applications
  are not treated as this form. Search-provider migration does not make the
  service catalog unlimited.
- Offline tests cover direct success without Google, ordered fallback, missing
  evidence, wrong study years, cancellation and fresh fallback signals, alongside
  SDK configuration, public-only grounding prompts, citation mapping, URL
  admission and suggestions rendering. During the Google-only trial, the real
  Student Aid `/api/chat` request reached
  `google_grounding` and returns `grounding_quota`, rather than the old
  `missing_service` or government-page `fetch_failed` state.
- A direct search-enabled request returned HTTP 429 `RESOURCE_EXHAUSTED`;
  ordinary Gemini generation succeeded. A successful live grounded answer,
  real Google citation redirects and real Search Suggestions rendering remain
  release checks once quota is available.
- The revised direct-first path was exercised live: personal income tax
  completed using a freshly fetched Canada.ca source; Student Aid recorded
  direct `fetch_failed` followed by Google's `grounding_quota`, with no answer
  from memory. Hotspot connectivity remains the user's next step, not a
  verified certificate fix.

## References

See [supporting evidence](../research/google-search-grounding.md).
