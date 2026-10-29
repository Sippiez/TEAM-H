# 0004: Server-side Gemini streaming chat

- Status: Accepted
- Date: 2026-10-29

## Context

Replace prototype chat replies without changing the PDF reader or deterministic
field explanations. Preserve document isolation, selected-field context,
English/French answers, cancellation and a 30-second deadline. The team requested
the cheapest stable model with reasoning, rather than a preview or larger model.

## Decision

Use the installed `@google/genai` SDK in a `server-only` module, called by the
POST `/api/chat` handler. Keep credentials server-side. Return UTF-8 plain text;
prefetch the first text chunk so lazy provider failures can still become JSON
502/504 errors before HTTP 200 is committed. Later failures error the body.
Do not substitute a success-shaped fallback for an empty or failed response.

Use the stable `gemini-3.1-flash-lite` by default, with `ThinkingLevel.LOW` and
a total output cap of 2,048 tokens, including reasoning. The former 700-token
cap could exhaust the budget during thinking before producing an answer.
Leave temperature at the model default. Keep `GEMINI_MODEL` configurable;
Gemini 2.5 overrides use a nonzero 512-token thinking budget instead of
Gemini 3's thinking-level setting. Return only answer text, not thought summaries.

Google lists 3.1 Flash-Lite as stable with thinking support. Standard text pricing
checked on 2026-10-29 is USD $0.25 per million input tokens and $1.50 per million
output tokens, including thinking. The cheaper 2.5 Flash-Lite returned 404 with
the configured account; 3.1 Flash-Lite successfully generated text. Tests of
3.8 Flash and the latest-Flash alias exceeded the required 30-second deadline.
Do not silently fail over to another model or incur larger-model costs.

Keep `cacheComponents: true` and use Next.js's default Node.js runtime. In the
installed Next.js 16.4.3, explicit `runtime` and `dynamic` route-segment exports
are incompatible with Cache Components. Preserve the existing Tailwind Turbopack
loader; removing it breaks CSS compilation.

## Data and lifecycle boundaries

Send at most 250 sanitized field summaries to Gemini, plus the selected field
even if it falls outside that list, document metadata and 12 recent messages
capped at 1,000 characters each. Never send PDF bytes or entered field values.
Metadata and messages remain untrusted input; prompts prohibit invented
requirements, personal-information requests and professional advice. This is
prompt-based risk reduction, not a guarantee of factuality or injection safety.

Track one active request per document or navigator conversation, reject duplicate
submissions synchronously, and invalidate request identities on reset/removal.
Propagate cancellation and ignore stale results. Store each message's language
for correct screen-reader pronunciation after switching interface languages.
Curated field explanations remain separate and in English.

## Consequences

An API key and a model accessible to the deployment account are required for
chat, but not for field explanations. The UI discloses external metadata/chat
processing and warns against personal information. Provider availability,
model access, billing and rate limits can still prevent live replies. Google
currently lists 2027-05-07 as 3.1 Flash-Lite's shutdown date; reassess the model
before then. Public deployment still requires access controls and rate limits.

## Sources

- [Model-selection research and live verification](../research/gemini-model-selection.md)
- [3.1 Flash-Lite model, stable status and thinking support](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.1-flash-lite)
- [Thinking and shared output-token limits](https://ai.google.dev/gemini-api/docs/thinking)
- [Model deprecation schedules](https://ai.google.dev/gemini-api/docs/deprecations)
- Installed Next.js route-handler guide and production-build diagnostics.
