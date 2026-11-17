# Gemini model selection evidence

Checked 2026-10-29 for the team's request: cheapest stable model with reasoning.
Prices below are standard text rates in USD per million tokens, not batch rates.

| Model | Stable, thinking-capable | Input / output including thinking | Local access check |
| --- | --- | --- | --- |
| `gemini-2.5-flash-lite` | Yes, thinking must be enabled | Not selected | Configured account returned 404 |
| `gemini-3.1-flash-lite` | Yes | $0.25 / $1.50 | Completed direct SDK and live bilingual selected-field requests |
| `gemini-3.5-flash-lite` | Yes | $0.30 / $2.50 | Not tested; costs more than 3.1 |

Select `gemini-3.1-flash-lite` with low thinking effort. It is the cheapest
stable thinking model verified accessible to this account, not a claim that it
is the cheapest model for every account. Gemini 2.5 Flash also returned 404;
3.8 Flash and the latest-Flash alias exceeded the 30-second test deadline.

Final 3.1 selected-field smoke tests used synthetic metadata only, returned
HTTP 200 in English and French, and streamed two text chunks each. A broader
navigator request returned 504; do not treat model selection as proof of
reliable latency for every request. No credentials or real form values appear
in these notes.

Google lists 3.1 Flash-Lite's shutdown date as 2027-05-07. Model availability,
prices and lifecycle dates may change; verify them again before deployment.

## Official-answer streaming latency (2026-11-17)

The official-answer path buffered all model chunks before sanitizing and sending
text. Field explanations did not have this extra wait. Replacing the whole-answer
buffer with incremental filtering preserves verified citations and removes
model-written URLs, including constructs split across provider chunks.

Three runs before and after used the actual chat generator with a synthetic
100 ms lookup and four model chunks spaced 100 ms apart. No live API was called.

| Metric | Whole-answer buffer | Incremental filter |
| --- | --- | --- |
| First visible official-answer text | 539–557 ms | 217–232 ms |
| Time withholding text after the provider's first text chunk | 317–336 ms | 0–1 ms |

Keep the incremental filter. A deterministic regression test requires text to
reach the consumer before the provider resumes generation. These fixture timings
measure application buffering, not live model or government-page latency;
official-source verification still precedes answer generation.

## Official sources

- [3.1 Flash-Lite: model ID, stable version and thinking support](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [3.5 Flash-Lite: stable version and thinking support](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Thinking controls and shared output-token limit](https://ai.google.dev/gemini-api/docs/thinking)
- [Deprecation schedules](https://ai.google.dev/gemini-api/docs/deprecations)
