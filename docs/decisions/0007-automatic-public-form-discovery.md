# 0007: Automatic public-form discovery

- Date: 2026-10-29
- Status: Accepted
- Search-provider decision superseded by [0008](0008-serper-web-search.md).
- Amends: [0006](0006-google-search-grounding.md)

## Context

A download question about the open citizenship certificate application
(`CIT 0001`) produced a successful Gemini function-call response but no lookup.
The PDF reader could identify its number, but neither the form nor citizenship
certificates existed in the lookup catalog. The planner received the question,
not the unregistered form identity; `unknown` arguments failed validation and
triggered a service dropdown that could not offer the correct service.

The user explicitly chose automatic discovery using a public form title/number
on the approved government sites rather than retaining the catalog gate.

## Decision

Retain catalog routing as a fast path, but accept a separate bounded public-form
identity without a catalog service ID. The browser extracts printed heading text
and a form number locally, excluding text within widget rectangles. The chat
API and scoped follow-up context carry the validated title/number. Bare public
numbers and recognizable application titles can also resume a prior question.
PDF bytes, widget values, filenames, field metadata and chat history are not
passed to page discovery or search.

Keep direct retrieval first. Registered forms retain fixed pages. Unregistered
forms use Brave discovery when configured; without it, `CIT`/`IMM` numbers use
IRCC's standard form-information directory, while other forms use ordinary
Gemini to suggest at most two candidate URLs. A model suggestion is not evidence.
Every candidate and matching information-page link passes the existing URL,
DNS, pinned HTTPS, redirect, archive and content checks before becoming a source.
Numbered forms require an exact token-bounded number match. Title-only forms
require all distinctive title terms. Link traversal stays within five total
candidates, three fetches, two concurrent requests and the ten-second sub-budget.

When jurisdiction is unknown, discovery may consider only the existing fourteen
approved roots. Admitted source hosts establish jurisdiction. Matching sources
from more than one jurisdiction require a government/region choice rather than
merging variants. Explicit jurisdictions still restrict all sources.

Remove the service dropdown in both languages. If identity is unavailable, state
what is missing and request a blank text-based form or its public title/number.
Retain jurisdiction recovery when genuinely needed.

Google Search grounding remains a fallback, with the same metadata, citation,
suggestions, quota, cancellation and admission requirements. Its prompt may now
include the bounded public form title/number. No SDK or model migration is part
of this decision.

## Conversation-scope correction (2026-10-30)

A reported three-turn conversation switched from SIN to Saskatchewan student aid,
then asked for "student aid from mainotba". Exact jurisdiction matching did not
recognize the misspelling, while repeating the service implicitly retained
Saskatchewan. This dispatched Saskatchewan evidence for a new-region question;
it was not a three-turn context-window limit.

Repeating a provincial service alone no longer confirms the prior jurisdiction.
Without an explicit region, recognized form scope, or a reference back such as
"What about the fees?", request jurisdiction clarification instead of silently
reusing stale sources. Do not guess or autocorrect a government jurisdiction.
An explicit region or recovery choice resumes lookup for that region. Regression
tests cover the reported sequence, the minimal stale-scope case, bilingual
follow-ups, and clarification followed by Manitoba.

## Consequences

- A new identifiable form does not need a new catalog service or form entry.
  Directory candidates and generated candidates can still be unavailable,
  incorrect, archived or irrelevant; none are silently accepted.
- A blank form's printed title is now part of the search privacy boundary.
  Both language notices warn against personalized or flattened documents, whose
  printed text may contain personal information.
- Existing official-domain restrictions remain unchanged, including exclusion
  of `.gc.ca`. Domain membership is not proof of factual correctness.
- Development logs redact unregistered titles/numbers and show allowlisted
  planner argument values/status to make `selection: null` diagnosable.
- Google returned HTTP 429 during investigation. A different SDK would not
  remove this provider-side quota restriction.
- See [verification evidence](../research/automatic-public-form-discovery.md).
