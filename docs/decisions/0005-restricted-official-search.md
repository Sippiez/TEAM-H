# 0005: Restricted official information search

- Status: Accepted for implementation; production enablement pending provider credentials and review
- Date: 2026-10-29

## Context

The service navigator needs current official information without exposing
arbitrary search or fetch capabilities to the model. The user fixed the content
roots to exactly `gov.bc.ca`, `alberta.ca`, `saskatchewan.ca`, `gov.mb.ca`,
`ontario.ca`, `quebec.ca`, `gnb.ca`, `novascotia.ca`, `gov.nl.ca`,
`princeedwardisland.ca`, `yukon.ca`, `gov.nt.ca`, `gov.nu.ca` and `canada.ca`,
including only their dot-delimited subdomains. The user supplied this list on
2026-10-29; this records the requested policy, not an independent review of
government ownership or page accuracy.

The current deployment has no approved search-provider account or credential.
The adapter therefore needs a deterministic, explicitly unavailable state until
the deployment configures a provider key. No account was created and no live
search was performed.

## Decision

Implement one server-only Brave Search API adapter using its fixed Web Search
endpoint, `https://api.search.brave.com/res/v1/web/search`, authenticated by the
server-only `BRAVE_SEARCH_API_KEY`. The adapter parses only the explicit
`web.results` collection, drops entries marked as sponsored/ads, and treats
every remaining URL as an untrusted candidate. Search snippets and response
summaries are never evidence. There is no provider fallback.

The application accepts only finite service, facet, jurisdiction and language
identifiers. The server builds the outbound query from its own bilingual
catalog and selected jurisdiction; it never sends chat history, form metadata,
filenames, uploaded files, field values, or model-authored query text to Brave.
The API credential remains on the server. An empty key yields `unavailable`;
the application does not produce a current-facts answer from model memory or
saved guidance in that case.

Official candidates, every redirect, final source and rendered link share one
fixed URL policy. Fetching uses a manual-redirect HTTPS transport: DNS answers
must all be public, the socket lookup is pinned to a previously validated
address, and the next redirect is policy-checked before connection. The fetcher
does not send cookies or credentials, execute page code, load subresources,
follow meta refresh, or submit forms. It accepts bounded HTML/plain text only.
Every successful extracted page receives an application-issued source ID and a
server-clock retrieval timestamp.

Service relevance uses the same whole-keyword matching as request selection;
short identifiers such as `SIN` cannot match inside ordinary words. Archive
notices are checked across the document before extracting its main content.
Candidates that resolve to the same final page share one source entry. Only
standalone field-meaning questions may skip lookup; combining a field question
with current-instructions wording must still use the restricted lookup path.

The 30-second chat deadline remains unchanged. Lookup is limited to one
provider search, five candidates, three page requests, two concurrent page
requests, three redirects per page, and a 10-second retrieval sub-budget.
Live provenance is separate from reviewed snapshots; existing saved guidance
has no recorded content-review date.

## Consequences and release checks

- `BRAVE_SEARCH_API_KEY` is optional in local configuration and mandatory for
  live search. Automated tests use fake provider and transport adapters and no
  credentials.
- The provider adapter's endpoint and parsing contract are implemented and
  tested deterministically, but an authenticated live contract check remains a
  release prerequisite because no key was available. Review current provider
  cost, data handling, rate limits, response fields and service terms before
  deployment.
- The service keyword catalog is finite and intentionally incomplete. Unknown
  services or unclear jurisdictions request clarification rather than broad
  free-text search.
- Official-domain membership proves only that a URL falls within the user's
  approved host policy. It does not independently prove a page is current,
  accurate, or appropriate; generated summaries retain that limitation.
- A new content root requires explicit user approval and a code change. Neither
  the model, provider results, redirects nor page content can expand the
  registry.

## References

- [Brave Search API documentation](https://api.search.brave.com/app/documentation)
- [Implementation plan and acceptance criteria](../../.vscode/official-search-implementation-plan.md)
