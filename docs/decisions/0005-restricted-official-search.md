# 0005: Restricted official information search

- Status: Superseded by [0006: Google Search grounding](0006-google-search-grounding.md); retained as the historical direct-retrieval design
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

The deployment has no approved search-provider account or credential.
The initial adapter therefore returned an explicitly unavailable state until
a provider key was configured. On 2026-10-29, after this blocked a personal
income tax question, the user chose live official-page lookups without an extra
API key. No account was created and no live provider-backed search was performed.

## Decision

Implement one server-only Brave Search API adapter using its fixed Web Search
endpoint, `https://api.search.brave.com/res/v1/web/search`, authenticated by the
server-only `BRAVE_SEARCH_API_KEY`. The adapter parses only the explicit
`web.results` collection, drops entries marked as sponsored/ads, and treats
every remaining URL as an untrusted candidate. Search snippets and response
summaries are never evidence. There is no alternate search-provider fallback.

The application accepts only finite service, facet, jurisdiction and language
identifiers, plus an optional recognized public form ID. The server builds the outbound query from its own bilingual
catalog and selected jurisdiction; it never sends chat history, form metadata,
filenames, uploaded files, field values, or model-authored query text to Brave.
The API credential remains on the server. Without a key, mapped federal
services use fixed official-page candidates from the existing resource catalog:
passport, personal income tax, SIN, EI, child benefits, CPP and OAS/GIS.
The service/facet mapping is shared with saved navigation, but only freshly
fetched page content can become evidence. A saved title or description cannot
establish a current fact. Pages still pass the existing host/IP/redirect,
jurisdiction, service relevance and archive checks, with the same retrieval
budgets and dated provenance. This strategy is reported as `official_page`,
not `search`. Current mapped service pages are English; French synthesis uses
their live excerpts and preserves source-language labels.

Unmapped services and provincial/territorial discovery still yield `unavailable`
without a key; known-form direct-page retrieval also does not require this key.
A configured Brave request failure or a failed direct-page fetch never silently
switches strategies. The application does not produce a current-facts answer from
model memory or saved guidance when retrieval is unavailable.

### Context and recovery

The application resolves natural follow-ups from the active document's exact
public form ID and conversation-scoped catalog IDs. It does not derive search
terms from filenames, PDF fields, entered values or assistant claims. Federal
program ownership supplies the federal jurisdiction; provincial services ask
for a region only when none is known. An explicit, finite service/region choice
resolves ambiguous questions and resumes the original request. Context is kept
per document/navigator and cleared with the existing session lifecycle.

For download questions about `PPTC 153`, `ISP 1000` and `ISP 3550`, use the form registry's
fixed Canada.ca information page as the initial lookup strategy. No search
provider is called on this path, and a failed page fetch does not silently
switch to a provider. The page must be fetched now, pass the same URL/IP/
redirect policy, and mention both the service and public form identifier before
becoming live evidence. Other questions use the configured Brave adapter or,
without a key, the mapped official-service pages described above.
The ISP-1000 form identity and information page were checked against the
[official CPP application page](https://www.canada.ca/en/services/benefits/publicpensions/cpp/apply.html).
That page links to a `.gc.ca` download; the requested allowlist still blocks it.
Expose that limitation without emitting or fetching the excluded download URL.

`ISP 3550` is the OAS/GIS application, verified against the
[official OAS application page](https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/apply.html)
on 2026-10-29. It has a distinct service selection and saved navigation from CPP.
Its download also uses an excluded `.gc.ca` host. Typed registered identifiers
can clarify the prior user question, including an earlier failed clarification;
the same resumed question is used for facet selection and grounded synthesis.
Only bounded registry matches are recognized, so the `ISP 3550A` reference guide
cannot be mistaken for the `ISP 3550` application. Follow-ups retain a changed
service scope; an explicit "this form" reference returns to the open document.

Unconfigured discovery has its own user-facing state, rather than a misleading
retry loop. Saved official navigation links remain separately labeled as not
checked live. Interrupted answers retain partial text and sources with an
incomplete marker and a scoped retry action. Suggestions, clarifications and
recovery copy follow the interface language; citations use numbered references,
not internal source IDs.

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

- `BRAVE_SEARCH_API_KEY` is optional in local configuration and mandatory only for
  broader provider-backed discovery. Mapped federal service pages remain live
  without it. Automated tests use fake provider and transport adapters and no
  credentials.
- The provider adapter's endpoint and parsing contract are implemented and
  tested deterministically, but an authenticated live contract check remains a
  release prerequisite because no key was available. Review current provider
  cost, data handling, rate limits, response fields and service terms before
  deployment.
- The real CPP `ISP 1000` direct-page path was exercised through `/api/chat`:
  it produced a live dated Canada.ca source, the excluded-download warning,
  and a complete grounded answer without a Brave credential. The OAS
  `ISP 3550` path was also verified with a selected field, both for the
  original download question and a typed identifier recovering an earlier
  failed clarification. Both returned the live OAS application page and
  completed grounded answers, without emitting the excluded download URL.
  This does not
  constitute a credentialed Brave contract test or a content review of all
  supported services.
- The personal income tax failure was reproduced through `/api/chat` as
  `unavailable / provider_not_configured`. After the keyless service-page change,
  the same request fetched the live Canada.ca personal income tax page, returned
  `verified / official_page` with dated provenance, and completed a grounded
  answer. Regression tests cover all seven mapped federal services and facets
  in both interface languages, jurisdiction isolation, and failed, archived,
  irrelevant or blocked page checks.
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
