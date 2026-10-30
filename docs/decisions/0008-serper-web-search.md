# 0008: Serper web search

- Date: 2026-10-29
- Status: Accepted
- Supersedes: The search-provider choices in [0006](0006-google-search-grounding.md)
  and [0007](0007-automatic-public-form-discovery.md).

## Context

The user requested Serper because Gemini's built-in Google Search calls were
quota-limited. A fresh differential check returned ordinary generation success
and HTTP 429 `RESOURCE_EXHAUSTED` for the same model with search enabled.
The user configured `SERPER_API_KEY` in the ignored `web/.env`; a public Serper
request returned HTTP 200 and five organic results. No credential was printed.

## Decision

Keep Gemini and the existing SDK for planning, field assistance and answer
synthesis. Replace Brave discovery and Gemini Google Search grounding in the
active chat path with a server-only Serper REST adapter. Do not select another
model, enable billing, install dependencies, or change trust stores.

Try registered form pages, mapped service pages and standard IRCC directory
pages directly first. If no mapping exists, search Serper immediately. If a
mapped lookup cannot verify evidence, search Serper once with a fresh bounded
signal. Never repeat a Serper attempt or fall back on clarification or parent
cancellation. Preserve the first failure in fallback metadata.

POST public canonical terms to `https://google.serper.dev/search`, authenticating
with the server-side `X-API-KEY` header. Use Canadian localization, the interface
language, five organic results and the approved `site:` roots. Do not send chat
history, arbitrary question wording, filenames, PDF bytes, field metadata or
entered values. A blank form's validated public title/number may be included.

Treat results only as candidate URLs, never evidence. Retain the fourteen-root
URL policy, jurisdiction admission, pinned public DNS/HTTPS, redirect, content,
archive and exact-form checks. Ignore ads, answer boxes and snippets. Gemini
summarizes only freshly verified excerpts through the existing citation path.
Upgrade search-index HTTP canonical links to HTTPS before admission; never
contact HTTP endpoints or unwrap unapproved search redirects.
Existing Google-grounded message types/rendering remain compatible; production
chat no longer requests new Google grounding or Search Suggestions.

Retain the 30-second chat deadline. Each lookup attempt has a ten-second
search/retrieval budget, five candidates, three page requests and concurrency
two. Bound provider response bodies to 256 KB. Classify missing credentials,
authentication errors, quota/credit errors, malformed responses, cancellation
and page-retrieval failures explicitly, with English/French user messages.

## Consequences

- Search is independent of Gemini grounding quota, but Serper credits/rate
  limits and ordinary Gemini generation quotas still apply.
- Serper cannot repair TLS failures when the app fetches official pages.
  Such failures do not authorize snippet-based answers or weaker verification.
- Known pages still cost no search credits when directly verified.
- No model-generated discovery URLs or automatic retries spend hidden credits.
- Configuration and privacy notices now identify Serper. Its data handling
  and commercial limits need review before deployment.
- See [verification evidence](../research/serper-web-search.md).
