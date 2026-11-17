# 0011: Natural conversation with official verification

- Date: 2026-11-17
- Status: Accepted
- Updates: The selected-field conversational behavior in 0009.

## Context

Exact field-question and rephrase patterns made ordinary follow-ups brittle.
General questions such as "Who is a guarantor?" triggered official lookup even
when the user only wanted a definition. Field-intent requests also discarded
history in the browser, API and answer prompt.

The user approved natural explanations from model knowledge while requiring
official verification for government rules, requirements, eligibility, fees
and deadlines. A selected field should be optional context, not a boundary.

## Decision

Use the configured AI provider for a bounded, structured routing request before
each user-authored chat turn. Supply the latest message, up to 12 recent messages
of 1,000 characters each, sanitized form metadata, optional selected-field
context and saved public lookup scope. Resolve a standalone question for both
routes before answering: a new concept explanation becomes the subject of a
subsequent rephrase, rather than jumping back to an older selected field.
Validate the response shape, route enum, nonempty question length and successful
completion. Invalid output or provider failure
fails the request explicitly; never default to general conversation on error.
Only the application-generated overview without a user message bypasses routing.

General explanations, examples, writing help and natural follow-ups stream using
the original message, resolved question and recent conversation. They may use general knowledge,
but must not present it as verified government guidance or assert government
requirements from memory. Follow the latest subject rather than automatically
returning to the selected field. Explicit field intent focuses the new selection
while retaining history at every layer.

Government-rule requests, including mixed questions and rephrases of previous
rule answers, retain the verified-official-information path. The router supplies
a standalone question for understanding and synthesis. It never supplies a raw
search query or discovery URL. Only validated catalog identifiers derived from
that question may help resolve service, topic and renewal mode. A suggested
province must also appear in user-provided public context, not just model output
or an assistant message. Explicit current services and public form identities
retain priority.

Public form identities come only from the existing validated user/document/saved
scope paths, never the model rewrite. Existing deterministic public-query
construction, government URL/DNS/TLS checks, retrieval budgets, live evidence,
citation filtering and no-memory fallback on verification failure remain intact.
Prior assistant text helps routing understand a follow-up; it is not evidence
for official synthesis.

## Consequences

- Conversation no longer depends on a growing list of field or rephrase phrases,
  and works without selecting a field or opening a PDF.
- General guarantor definitions need no lookup; passport-specific guarantor
  qualifications still use the requirements page and its guarantor section.
- OpenAI and Gemini use the same routing and answer policy. The OpenAI default
  remains `gpt-6-luna`, as decided in 0010.
- Routing adds model latency and token usage within the existing overall
  deadline. No additional vendor, dependency, persistent chat store or search
  input category is introduced.
- Semantic routing and general explanations remain model behavior, not a
  guarantee of factual correctness. Prompts are not a security boundary; code
  continues to enforce search privacy, validated identifiers and URL admission.
- Automated regressions use controlled provider responses to cover conversation
  continuity, new field focus, topic changes, public-query isolation, routing
  failures and failed verification.
- A live six-turn acceptance check with the configured OpenAI `gpt-6-luna`
  account covered a field explanation, general guarantor definition, an indirect
  one-line rephrase of that definition, an unrelated concept, passport guarantor
  qualifications and their one-sentence rephrase. Both government-rule turns
  retrieved a verified official source; the general rephrase retained the role
  concept rather than reverting to the old date field. This is bounded
  verification, not a guarantee of every model response. Gemini remains covered
  by controlled provider regressions rather than this live check.
