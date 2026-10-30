# Automatic public-form discovery evidence

Date: 2026-10-29 (local; live source timestamp below is UTC).

## Reproduction and cause

The `chat.test.mjs` regression for `CIT 0001` initially failed with:

```text
The open citizenship form must dispatch a lookup, not a missing-service selector
```

The catalog had no citizenship service or CIT 0001 registration. The planner's
`STOP` finish reason indicated completed generation, not valid tool arguments
or a successful lookup. Its `unknown`/invalid identifiers produced a null
selection and the missing-service UI.

## Live observations

- The existing PDF fixture `test-forms/cit0001e.pdf` yields the printed public
  number `CIT 0001` and citizenship certificate heading without using its filename.
- Ordinary Gemini initially suggested broad citizenship process pages. Those
  pages did not contain the exact form number in the bounded retrieved text and
  were correctly rejected. URL suggestions alone cannot establish evidence.
- The production fetcher successfully retrieved the
  [CIT 0001 form-information page](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/cit0001.html)
  and the
  [citizenship application package](https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides/application-citizenship-certificate-adults-minors.html).
  Both named CIT 0001 in the retrieved text and were not marked archived.
  The package also links to numbered `CIT` and `IMM` form-directory entries.
- After routing changes, the real development `/api/chat` request for
  "where do I download this form from?" returned `verified / official_page`,
  jurisdiction `federal`, the CIT 0001 page as `live_official`, and a completed
  synthesized answer. Its retrieval timestamp was `2026-10-30T01:37:32.303Z`.
  This path did not consume Google Search grounding quota.
- Google Search fallback attempts returned HTTP 429 (`grounding_quota`).
  Successful live Google grounding and authenticated Brave discovery remain
  external release checks, not demonstrated by the direct-page success.

## Regression coverage

Tests exercise the real routing and lookup seams with isolated provider/transport
fakes: unregistered numbers and titles, follow-ups and changed services,
bounded identity validation, query privacy, suggested-page verification,
government-only link traversal, exact form matching, conflicting jurisdictions,
Google citation admission, log redaction, and bilingual removal of the service
dropdown. PDF extraction also uses the actual CIT 0001 fixture.
