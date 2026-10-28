# 0002: Government Form Helper MVP scope and delivery gates

- Date: 2026-10-28
- Status: Accepted (design baseline only; implementation not authorized)
- Owner: TODO

## Context

The team agreed on an MVP for the Government Form Helper & Service Navigator
after a design interview. The product helps both first-time applicants and
people assisting them understand government forms and find official next steps.

This record is the authoritative scope baseline. It supersedes conflicting
proposals in the earlier [MVP design draft](../mvp-design.md) and refines the
AI/backend direction in [decision 0001](0001-web-stack-and-ui-kit.md).
Existing prototype behavior is not evidence that these requirements are met.
Recording this agreement does not authorize implementation, installations,
paid services, or public deployment.

## Options considered

- **Support arbitrary PDFs or a verified form catalogue:** choose verified
  federal forms/versions with readable text and extractable fields. Reject
  unsupported documents instead of guessing field locations or requirements.
- **Reset chat for every upload or share a temporary session:** choose one
  conversation with multiple documents and explicit document/field context.
- **Curated sources only, unrestricted search, or government-only live search:**
  choose reviewed guides plus live search restricted to verified official
  federal, provincial, and territorial sites.
- **Personal-account workarounds or an authorized AI integration:** prefer the
  documented, organization-approved Copilot SDK route, subject to access,
  data-handling, and spending approval. GitHub Models is not an alternative:
  its inference service has been retired.
- **Public deployment immediately or a local demonstration:** choose a local,
  presenter-controlled hackathon demo with feasibility gates before the full
  workspace build.

## Decision

### Coverage and non-goals

- Explain supported **federal** forms only. Start with one adult passport
  application journey, subject to verifying suitable English/French PDFs and
  guides.
- Provide service navigation both with and without an uploaded form.
- Initial federal resource coverage: passports, SIN, EI, child benefits,
  CPP/OAS, and CRA sign-in. Include clearly labelled official provincial and
  territorial service-directory links, not detailed provincial program advice.
- Do not claim comprehensive service coverage. A newly discovered form/version
  is not supported until it has been verified.
- Explain rather than fill, export completed forms, submit applications, decide
  eligibility, or provide legal, immigration, or tax advice.
- Do not collect actual field answers or provide personalized document
  checklists, accounts, or saved history.

### Documents and session behavior

- One temporary session contains one shared chat and up to **5 PDFs**, with
  limits of **25 MB per PDF** and **30 pages per PDF**. Show limits before upload
  and validate files rather than trust filename extensions.
- Support blank PDFs only, requiring readable text, reliably extractable form
  fields, and a match to a verified supported federal form/version.
- Reject image-based PDFs, unsupported formats, and unrecognized forms/versions
  explicitly. No OCR or guessed field overlays. Offer a supported sample or
  official service search after rejection.
- Reject locally detected user-entered field values. Warn that this check
  cannot guarantee detection of every personal detail, annotation, or other
  modification; do not promise comprehensive sanitization.
- Keep an explicit active document and selected field. Ordinary questions use
  that context; cross-document comparisons require explicit document references
  or selection. Clarify ambiguous references rather than combine requirements
  silently.
- Switching documents preserves the transcript. A selected field remains
  visible as an "Asking about..." context chip until changed or cleared.
- Removing a document releases its PDF and excludes it from future context;
  retained messages are visibly labelled as referring to a removed document.
  Ignore in-flight answers for a document removed before completion.
- "New session" clears documents, chat, and explanation caches. Reloading the
  page also starts fresh; session content is not persisted.
- Allow one AI response in progress at a time.

### Interface, accessibility, and language

- Use the accepted Next.js, React, TypeScript, Tailwind, and shadcn/ui stack.
  Next.js handles source lookup and AI requests; do not introduce a separate
  Python backend.
- Use a neutral, legible light design with a clear "not an official government
  service" notice. Do not impersonate Canada.ca or prioritize theme customization.
- Provide landing routes to upload a blank PDF, try an English/French sample,
  or find a government service.
- On desktop, keep form, chat, and the selected-field side panel available
  together. Provide a usable narrow-screen layout with accessible chat/panel
  controls, without requiring identical mobile behavior.
- Field panels show plain-language meaning, requested information, supported
  formats/fictional examples where applicable, and precise official sources.
  Add required-field indicators, common mistakes, and other rules only when
  supported by evidence; avoid empty sections and guessed requirements.
- Provide a labelled field list and keyboard navigation in addition to
  clickable PDF overlays, with visible focus and accessible panel/chat updates.
- Chat may offer clickable document/page/field references. Navigate only when
  the user chooses one, then scroll to and highlight the field. Present labelled
  choices when several fields match rather than choosing an arbitrary result.
- English and French cover the interface, errors, form overviews, field
  explanations, and chat. The user's language choice controls future answers
  and refreshed explanations.
- Preserve original PDFs and existing chat messages when switching languages.
  Prefer official sources in the selected language; label a source available
  only in the other language.

### Grounding and government-only web search

- Use reviewed, version-matched official form guides first. Show when snapshot
  sources were checked and recheck them before the demo; do not imply real-time
  policy updates from a stored snapshot.
- Live web search is allowed for additional/current information and standalone
  service navigation, but only verified official federal, provincial, and
  territorial government pages may be fetched or cited.
- Enforce a vetted official-host allowlist in the application for search
  results, fetched pages, and redirects. A model instruction alone is
  insufficient. Exclude ads, third-party summaries, and off-allowlist fallback.
- An approved third-party search index may be used, but search queries contain
  only necessary non-personal service/form keywords, not uploaded files, full
  chat histories, or personal details.
- Distinguish live retrieval from reviewed snapshots and show retrieval/check
  dates. Current official instructions take precedence.
- Cite sources supporting the actual claim, not merely a department homepage.
  Do not invent URLs. If evidence is insufficient, explain what is known and
  missing and offer a verified official guide/contact link.
- If no verified official search result is available, say so without widening
  the permitted sites. Report search failures explicitly; do not present cached
  guidance as a successful fresh search.

### Privacy, AI capabilities, and failure behavior

- Render and extract PDFs in the browser; PDF bytes stay in browser memory.
  Send only necessary blank-form context and chat messages to the backend and
  approved AI provider.
- Do not persist document content, chat, or explanation caches in browser
  storage, application databases, or application logs. Release prior document
  data on removal/reset and verify session cleanup.
- Warn before upload and beside chat against sharing personal information.
  Disclose external AI/search processing. Canadian-only processing is not a
  mandatory MVP requirement, but provider data terms require team approval.
- Prefer the documented Copilot SDK with a private headless runtime and an
  approved organization-funded authentication path. Keep credentials
  server-side. Do not extract private tokens, share personal credentials, or
  bypass access, billing, or rate limits.
- No live AI until access, data handling, and spending are approved. If the
  preferred route is unavailable, obtain approval for another supported
  provider rather than silently substitute one.
- Use only approved accounts/services. Agree on usage budgets and request/input
  limits before the demo; no new paid services or unbounded usage without
  approval. Copilot session credit limits are soft and can be exceeded by one
  response, so they are not a guaranteed spending ceiling.
- Restrict AI tools to supplied blank-form context, curated catalogue/guide and
  field lookups, and constrained government-only search/fetch. No general shell,
  filesystem access, unrestricted browsing, or submission capabilities.
- Treat PDF text and retrieved content as untrusted data, never as instructions.
- Use real AI responses with visible loading, errors, and retry. Keep the PDF
  and already-loaded official links usable during AI failures.
- Label pre-authored guidance honestly. Never disguise rule-based/scripted
  answers or unsupported model knowledge as successful grounded AI.

### Delivery and acceptance gates

The first release is a local, presenter-controlled hackathon demonstration,
with Next.js and the private Copilot runtime on a team machine. Public hosting
and remote-user access require a separate deployment/access-control decision.

Before the full workspace build, prove:

1. **Bilingual PDF feasibility:** the candidate English PPTC 153 and French
   PPTC 154 PDFs have reliably extractable fields and meaningful labels in the
   intended renderer. Verify field coordinates, overlay/zoom alignment, and
   keyboard selection. The design review confirmed the official files exist,
   not that they pass these tests.
2. **Approved AI/privacy feasibility:** verify grounded bilingual responses,
   session isolation and cleanup, restricted tools, retention/logging behavior,
   and the approved access/data/spending arrangements. Provider approval is not
   established merely by SDK support.
3. **Search activation:** approve the search provider's access, data terms, and
   costs and verify government-only enforcement and explicit failure behavior.
4. **Performance:** measure the following targets in the demo environment;
   they are acceptance targets, not already-verified results.

| Interaction | Target |
| --- | --- |
| Selected-field highlight and loading state | Within 200 ms |
| Completed field explanation | Within 10 seconds |
| Stalled request becomes a retryable error | By 30 seconds |
| Repeat field explanation in the same session/language | Reuse the generated explanation |

Demo success means a user understands one confusing field and finds the
relevant official next step. Prove that journey before adding unrelated forms.
If a gate fails, report the exact failure and return for a scope/provider
decision; do not hide it with guessed overlays, persistence, or scripted success.

## Consequences

- A narrow supported-form catalogue and explicit rejection states are
  intentional reliability boundaries, not promises of universal PDF support.
- Multi-document context, full bilingual behavior, source provenance, and
  government-only live search are required MVP behavior, not stretch goals.
- The current rule-based prototype is not the accepted live-AI outcome.
- PDF compatibility, provider authorization/data terms/budgets, search
  enforcement, and measured performance remain outstanding gates.
- This task records the agreed design only. Implementation and installations
  need a subsequent request; research/feasibility results should be recorded
  in [docs/research/](../research/).

## Supporting references

Official references checked during the design review on 2026-10-28:

- [English adult general passport application (PPTC 153)](https://www.canada.ca/content/dam/ircc/migration/ircc/english/passport/forms/pdf/pptc153.pdf)
- [French adult general passport application (PPTC 154)](https://www.canada.ca/content/dam/ircc/migration/ircc/francais/passeport/formulaires/pdf/pptc154.pdf)
- [Copilot SDK backend services](https://github.com/github/copilot-sdk/blob/main/docs/setup/backend-services.md)
- [Copilot SDK server-to-server authentication and organization billing](https://github.com/github/copilot-sdk/blob/main/docs/auth/server-to-server-tokens.md)
- [Copilot SDK session credit limits](https://github.com/github/copilot-sdk/blob/main/docs/features/session-limits.md)
- [GitHub Models retirement notice](https://docs.github.com/en/github-models)
