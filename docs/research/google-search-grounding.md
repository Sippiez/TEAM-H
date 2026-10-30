# Google Search grounding evidence

## Verified findings

- [Google Search grounding documentation](https://ai.google.dev/gemini-api/docs/google-search):
  the existing Gemini SDK supports the `googleSearch` tool. Responses contain
  grounding chunks/supports and Search Suggestions. Citation insertion must
  respect UTF-8 byte offsets and response part indices.
- [Gemini API grounding terms](https://ai.google.dev/gemini-api/terms#grounding-with-google-search):
  preserve grounded output/citation links, display associated Search Suggestions,
  and account for Google's 30-day retention of grounding prompts/context/output.
- [Vercel Google provider documentation](https://ai-sdk.dev/providers/ai-sdk-providers/google):
  provider-hosted search is a model capability, not a local TLS trust-store
  repair. Migrating SDKs is unnecessary for this change.
- A live search-enabled request using the configured Gemini model returned
  HTTP 429 `RESOURCE_EXHAUSTED`. A separate ordinary generation returned `OK`.
  During the Google-only trial, the migrated Student Aid `/api/chat` path returned the typed
  `unavailable / grounding_quota` outcome. This is not a successful live search
  contract check.
- The earlier Saskatchewan page TLS failure was
  `SELF_SIGNED_CERT_IN_CHAIN`; certificate inspection showed a
  `PSPC-SSC FG SSL Proxy` issuer. No TLS bypass or trust-store change was made.
- The [official Saskatchewan forms page](https://www.saskatchewan.ca/residents/education-and-learning/saskatchewan-student-aid/student-loans-and-grants/printable-applications-and-forms)
  identifies "2026-27 Full-Time Saskatchewan Student Aid forms"; the supplied
  public PDF's first page identifies the full-time 2026-27 application.
  The page title need not contain numeric product reference `154091`.
- The user subsequently chose the previous direct method first and Google only
  on failure. "Use my data" was explicitly clarified as mobile data/hotspot.
  This authorizes fallback, not a TLS bypass or automatic network change.
- The revised direct-first `/api/chat` path returned a complete personal income
  tax answer with `verified / official_page` and `live_official` provenance,
  without Google grounding. The Student Aid request on the current connection
  returned `grounding_quota` with `fallbackReason: fetch_failed`, confirming
  that the direct attempt preceded Google. It returned no unsupported answer.

## Limitations

`site:` is a search hint, not a supported hard include-domain option. The app
therefore checks all citation destinations and rejects mixed-source answers.
Google grounding is not independent page verification. Successful live answer,
redirect gateway behavior and actual suggestions layout remain unverified
because grounding quota was unavailable. No model or billing changes were made.

Decision: [0006: Google Search grounding](../decisions/0006-google-search-grounding.md).
