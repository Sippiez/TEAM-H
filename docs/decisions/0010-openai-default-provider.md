# 0010: OpenAI as the default AI provider

- Date: 2026-11-17
- Status: Accepted
- Supersedes: The generation-provider defaults in 0004 and 0008.

## Context

The user requested OpenAI API model support alongside Gemini, defaulting to
GPT-6 Luna.

## Decision

Default `AI_PROVIDER` to `openai` and `OPENAI_MODEL` to `gpt-6-luna`. Read
`OPENAI_API_KEY` only on the server. Keep Gemini available through the explicit
`AI_PROVIDER=gemini` setting and its existing key/model variables. Never silently
switch vendors when credentials or an upstream request fail.

Use the OpenAI Responses REST API with native fetch, low reasoning effort,
bounded output tokens and `store: false`, without adding dependencies. Support
streaming answers, forced lookup-planner function calls and strict JSON schemas
for explanations and field-context association. Preserve existing prompts,
validation, cancellation, deadlines, citation filtering and Serper lookup policy.
Keep the existing internal generation shapes at the adapter boundary to avoid
duplicating the orchestration; historical Gemini-named entry points now dispatch
to the configured provider.

## Consequences

- Existing Gemini deployments must explicitly set `AI_PROVIDER=gemini`, or
  supply an OpenAI API key to use the new default.
- Chat, field explanations and context association all use the same provider.
- OpenAI receives the same bounded context previously sent to Gemini; PDF bytes
  and entered field values remain local. Privacy copy identifies both vendors.
- The default model ID is user-requested, not a claim of verified API access.
  Account/model availability must be confirmed before deployment. An unavailable
  model surfaces as a provider error; `OPENAI_MODEL` can override it.
- Responses token budgets include a 4,096-token reasoning allowance in addition
  to the existing visible-output budget. Other models must support Responses,
  low reasoning effort, function calling and structured outputs.
