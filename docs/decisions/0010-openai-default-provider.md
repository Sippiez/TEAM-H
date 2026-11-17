# 0010: AI providers and default selection

- Date: 2026-11-17
- Status: Accepted
- Supersedes: The generation-provider defaults in 0004 and 0008.

## Context

The user requested OpenAI API model support alongside Gemini, defaulting to
GPT-6 Luna. After OpenAI quota failures, the user requested Gemini as the
default rather than relying on quota fallback.

## Decision

Default `AI_PROVIDER` to `gemini` and `GEMINI_MODEL` to
`gemini-3.1-flash-lite`. Read `GEMINI_API_KEY` only on the server. Keep OpenAI
available through explicit `AI_PROVIDER=openai`, `OPENAI_API_KEY` and
`OPENAI_MODEL` (default `gpt-6-luna`). Do not switch vendors unless the operator
explicitly enables the optional OpenAI quota fallback below.

An exhausted OpenAI daily quota caused both field explanations and chat to
return generic provider failures despite valid local field context. At the
user's request, support `AI_FALLBACK_PROVIDER=gemini` with a configured
`GEMINI_API_KEY` as an opt-in fallback while keeping OpenAI primary. Only OpenAI
HTTP 429 responses trigger fallback. Use Gemini's configured model and preserve
the request's prompts, structured schemas, tool restrictions and abort signal.
Honor valid `Retry-After` delays for subsequent requests to the same primary
credentials/model. Do not switch after any primary stream output has been
emitted, or on authentication, parsing, refusal, cancellation or other failures.
Fallback failures remain explicit; they never become canned successful answers.

Use the OpenAI Responses REST API with native fetch, low reasoning effort,
bounded output tokens and `store: false`, without adding dependencies. Support
streaming answers, forced lookup-planner function calls and strict JSON schemas
for explanations and field-context association. Preserve existing prompts,
validation, cancellation, deadlines, citation filtering and Serper lookup policy.
Keep the existing internal generation shapes at the adapter boundary to avoid
duplicating the orchestration; historical Gemini-named entry points now dispatch
to the configured provider.

## Consequences

- Gemini deployments need only `GEMINI_API_KEY`; OpenAI requires explicit
  `AI_PROVIDER=openai` and `OPENAI_API_KEY`. Remove `AI_FALLBACK_PROVIDER` when
  selecting Gemini directly.
- Chat, field explanations and context association share provider selection and
  the opt-in quota-fallback policy.
- With quota fallback enabled, each generation may use Gemini while OpenAI is
  rate-limited. Both vendors receive only the existing bounded context, never
  PDF bytes or entered values. Without opt-in, vendor failures never switch
  providers automatically.
- OpenAI receives the same bounded context previously sent to Gemini; PDF bytes
  and entered field values remain local. Privacy copy identifies both vendors.
- The OpenAI model ID is user-requested, not a claim of verified API access.
  Account/model availability must be confirmed before deployment. An unavailable
  model surfaces as a provider error; `OPENAI_MODEL` can override it.
- Responses token budgets include a 4,096-token reasoning allowance in addition
  to the existing visible-output budget. Other models must support Responses,
  low reasoning effort, function calling and structured outputs.
