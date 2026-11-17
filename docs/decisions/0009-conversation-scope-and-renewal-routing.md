# 0009: Conversation scope and renewal routing

- Date: 2026-11-16
- Status: Accepted

## Context

Search could lose its subject after an interrupted answer or rephrase request,
inherit a federal jurisdiction for a provincial service, or use new-passport
instructions for a renewal. Short clarification replies also lost the original
question before synthesis. The investigation and reproductions are recorded in
[the search/context review](../research/2026-11-16-search-and-ai-context-review.md).

## Decision

Keep the current public lookup scope separately from assistant display messages,
per conversation/document. Lookup events replace that scope; requests without a
lookup event retain it. Carry it through chat/PDF transitions and clear it on
session reset or document disposal. Reuse only compatible jurisdictions.

Retain `passport` as the service identifier and add the optional, validated
`passportMode` enum (`new` or `renewal`). Renewal mode excludes the PPTC 153
new-application identity, uses the existing official renewal resource, and
requires renewal evidence. Preserve the mode in follow-ups, canonical queries,
answer scope and recovery links.

Recognize public CIT/IMM numbers inside form/download questions, and generic
identifiers when explicitly labeled as forms. Extract only the bounded identity;
reject ambiguous references, unrelated additional numbers and URLs. An explicit
new form takes precedence over the preceding service. Reconstruct user questions
through jurisdiction and rephrase replies for answer generation, separately from
public search arguments.

Use selected-field metadata for field-related follow-ups. Treat observed Gemini
finish reasons other than `STOP` as incomplete generation. Select bounded source
excerpts around fixed information-facet cues or exact form references before
clipping them.

## Consequences

Users can continue after a transient failure without repeating the service.
Renewal and new-application instructions remain distinguishable. The existing
allowlist, DNS/TLS checks, public-only Serper inputs, lookup budgets and source
provenance still govern retrieval. Excerpt selection is deterministic and bounded;
keyword cues do not guarantee that every useful fact on a page will be included.

Validation includes server and component regressions plus browser interaction
checks with controlled API fixtures. Live provider behavior requires configured
credentials and was not part of this verification.
