# formER

formER helps people understand government forms and find official service
instructions. The name stays **formER** in English and French.

Hackathon workspace. The topic, problem, and technology stack are intentionally
undecided. This repository provides team conventions and documentation
placeholders, not application boilerplate.

## Project brief

- **Topic:** TODO
- **Problem and target users:** TODO
- **Proposed solution:** TODO
- **Minimum viable demo:** TODO
- **Team members and responsibilities:** TODO
- **Submission requirements and deadline:** TODO
- **Demo and submission links:** TODO

## Getting started

1. Clone the repository and create a branch using the convention below.
2. Fill in the project brief once the hackathon topic is announced.
3. Capture findings in [docs/research/](docs/research/) and agree on the smallest
   useful demo.
4. Record the stack choice and other significant decisions in
   [docs/decisions/](docs/decisions/) before adding application scaffolding.
5. Replace the setup placeholders below with verified commands when tooling exists.

### Setup and validation

The MVP lives in [web/](web/) (Next.js 16, TypeScript, Tailwind CSS v4,
shadcn/ui). See [docs/mvp-design.md](docs/mvp-design.md) and
[decision 0001](docs/decisions/0001-web-stack-and-ui-kit.md).

- **Prerequisites:** Node.js 22.13 or later and its matching npm (verified with
  Node.js 24.22.2). The PDF renderer and other locked dependencies require a
  newer runtime than Next.js's minimum.
- **Install:** `cd web && npm ci`
- **Run locally:** `npm run dev`, then open <http://localhost:3000>. Choose
  **Adult passport application** under **Try a sample form** to use the bundled adult passport
  application (PPTC 153).
- **Checks:** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.
- **Deployment:** TODO.

`pretypecheck` generates Next.js route types, so `npm run typecheck` also works
before the first development server or build has run.
`predev` and `prebuild` copy the matching pdf.js worker and standard fonts
(including their licenses) into `web/public/`; these generated assets are
gitignored. PDF rendering uses the bundled fonts rather than relying on system
fonts such as ZapfDingbats. The interface keeps Atkinson Hyperlegible Next with
an explicit Arial/sans-serif fallback; automatic fallback-metric adjustment is
disabled because Next.js has no override metrics for this font.
`npm test` uses Node's built-in runner and the existing TypeScript
compiler to exercise chat validation, prompts, typed streaming, errors, timeouts,
cancellation, URL policy, Serper requests/errors, query privacy, and provenance using
isolated fakes, chat-only/PDF transitions, plus message/document identity across
Fast Refresh; it needs no API key or network.

If you're behind a TLS-inspecting proxy, `next/font` and npm can fail to
download. Point Node at your organisation's root CA instead of disabling TLS
verification:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/your-root-ca.pem
```

Chat uses server-side OpenAI streaming by default and needs `OPENAI_API_KEY`
(see below). Set `AI_PROVIDER=gemini` to use the existing Gemini integration.
During `npm run dev`, the server terminal prints `[openai]` or `[gemini]` events for API
requests, streaming responses, completion/errors, and official-information tool
execution. Logs include the model, enabled tools, validated public lookup
selections, source counts, token usage when provided, and elapsed time. They
exclude prompts, answer text, PDF context, API keys, and raw error messages.
Official lookup completion logs include the retrieval method; Serper search is
server-side and never enables Gemini's built-in Google Search tool.
Invalid planner calls show allowlisted
argument values (including `unknown`) and an argument-validation status rather
than only `selection: null`. Unregistered form labels are redacted from logs.
These logs are disabled outside development.
The default model is `gpt-6-luna`, with low reasoning effort. `OPENAI_MODEL`
can select another compatible OpenAI Responses API model; model availability
depends on the account and has not been verified with a live API call.
Gemini defaults to `gemini-3.1-flash-lite` when explicitly selected.
See [decision 0010](docs/decisions/0010-openai-default-provider.md).
Field-panel explanations also use the selected provider and require its key. They use the
selected field's printed question and instructions, plus curated guidance when
available. PDF loading and local field-context extraction do not require a key;
ambiguous contexts can be associated on demand using the selected provider.

Service navigation uses **direct official-page lookup first**, with **Serper
for web search**. Recognized download questions, mapped services and known
IRCC form-directory entries try their official pages without spending search
credits. If a mapped page cannot be verified, or no mapping exists, the server
uses `SERPER_API_KEY` to discover candidate pages. It fetches and verifies each
admitted candidate before the selected model synthesizes an answer from excerpts.
Neither Gemini's built-in Google Search tool nor Brave is used. No new SDK or
dependency is needed.

Forms no longer have to belong to the service catalog. The browser also extracts
a bounded public title from prominent printed heading text, excluding widget
text; the server can discover official pages from this title and/or a public
form number. `CIT` and `IMM` numbers first try IRCC's standard form-information
directory. Other forms use Serper, not model-generated URL guesses.
No search result becomes evidence until its page is fetched and checked.
Matching information-page links
can be followed within the existing five-candidate, three-fetch budget.
Download pages must identify the exact supplied form number, or match the
distinctive title terms when no number is available.

If a mapped lookup fails or finds no usable evidence, it tries Serper once.
A lookup that already used Serper is not repeated. Clarification and user
cancellation do not start a fallback. Discovery and search requests contain catalog keywords or
the public title (up to 200 characters) and number (up to 32 characters) from a
blank form, plus the information facet, interface language and jurisdiction when
known, not chat history, filenames, PDF fields, entered values or arbitrary
question text. Use blank forms only: printed text in a personalized or flattened
document may itself contain personal information.
The server builds the query deterministically from that public context and
the approved `site:` roots, with Canadian search localization and English/French
interface language. Serper receives the query, not the conversation.
Service selection and ordinary chat still receive the bounded context described
in the privacy notice.

Serper's organic result URLs are discovery hints only. Ads, snippets, answer
boxes and generated summaries never become answer evidence. Sources are labeled
**Live official source** only after successful page retrieval and checks.
Unavailable search, missing/invalid credentials, exhausted credits/rate limits,
and failed page verification return explicit lookup states, not answers from
model memory. Existing Google-grounded messages keep their legacy provenance
and suggestions display, but new requests do not use that provider.
Review Serper's credits, limits and data handling before deployment; see
[decision 0008](docs/decisions/0008-serper-web-search.md).

Recognized form IDs and conversation-scoped service selections resolve questions
such as "Where do I download this form?" and "What about the fees?". Federal
programs do not require users to repeat "federal". Lookup scope survives failed
and field-only answers, follows each document's conversation, and clears on
**New session**. A new explicitly named form replaces the previous service;
changing from a federal service to a health card asks for a province or territory.
Passport renewals retain their own routing and saved links through follow-ups.
Typed public form references can appear in form/download questions; generic
identifiers must be explicitly labeled as forms. Requests to rephrase an answer
and jurisdiction replies retain the earlier user question for synthesis. The service dropdown has been
removed. An identifiable unregistered form starts discovery automatically,
searching only the fourteen approved roots when its jurisdiction is unknown.
Jurisdiction is established from admitted source URLs, not guessed from a
filename. Matching results from multiple jurisdictions still ask which government
issued the form; known provincial services retain their region selector. If no
public form can be identified, the assistant explicitly asks for a blank
text-based PDF or its public title/number, rather than presenting a catalog menu.
A typed public form number or application title can resume the previous question.
OAS/GIS and CPP have distinct
service routing and saved links. Saskatchewan's 2026-27 full-time Student Aid
application (public product `154091`) is recognized locally from its public
first-page title, not its filename, and routes to Saskatchewan. Reopen an already
loaded PDF after updating the app to rerun identification. Other years and
part-time titles are not treated as this application.

Every source must resolve to one of the user-approved 14 official content roots
and the selected jurisdiction. Direct retrieval validates public DNS addresses,
pins HTTPS connections to validated addresses and checks every redirect before
following it. It fetches bounded HTML/plain text without scripts, subresources,
credentials or cookies, rejects archived/irrelevant pages, and checks recognized
form references. Excluded downloads are flagged without fetching or emitting
their URLs. TLS verification remains enabled.

Serper's `site:` query is a search hint, not a provider-enforced allowlist.
The application admits only approved URLs and the requested jurisdiction before
fetching. Sign-in pages, arbitrary redirects and excluded `.gc.ca` sources
remain blocked.

The total chat deadline is 60 seconds in both the browser and server. Direct lookup has a 10-second
sub-budget, at most five candidates, three page requests, two concurrent requests
and three redirects per page. A Serper fallback gets a separate 10-second
search-and-verification budget under the same overall deadline. There is at most
one Serper request per lookup; its JSON body is limited to 256 KB and five
organic candidates. Fallback metadata preserves the original direct failure.
Saved guidance stays separately labeled and never becomes live evidence.

Switching to mobile data/hotspot may avoid a network's TLS-inspecting proxy.
The application does not change networking or trust stores, and does not
disable certificate verification. Serper does not repair government-page TLS
failures: if discovered pages also cannot be verified, the lookup reports that
failure instead of answering from search snippets.
Interrupted responses preserve partial text and sources, mark the answer
incomplete, and provide retry; missing setup is not disguised as a retryable
network problem. After official pages are verified, generated answers stream as
complete words and citation/link constructs arrive rather than waiting for the
whole answer. Unverified citations and model-written URLs are filtered before
text is sent. Suggestions and recovery controls follow the interface language.
Starter suggestions yield space after the first question. Expandable AI/search
privacy details and a scrollable panel preserve a readable mobile answer area;
the personal-information warning remains visible in the shared header, rather
than repeated beneath each chat input.

PDF bytes and entered field values stay in the browser. Chat shares bounded
form and field metadata (including the filename), the selected field, and recent
messages with the external AI provider. Field explanations share bounded field
context; on-demand context association shares candidate printed text and layout
coordinates, not PDF bytes or entered values. Do not include personal information
in chat, filenames or field labels. Responses are not official guidance and can
be wrong; verify government requirements using the linked official guide.

**Ask about this field** sends only the selected field's metadata and document
identity (form number, filename and page count), without other fields or earlier
chat messages. Regular chat follow-ups and form overviews retain the broader
form context. Requests to simplify a field explanation keep that field and the
recent conversation in context; new fee or download questions still use official
lookup.

You can keep up to five PDFs open as document tabs. **Add PDF** opens
another, and each tab has its own close button. The button to the left of
**New session** switches the interface between English and French, and the
choice is saved in the browser. New chat answers use the interface language at
request time; existing answers are not retranslated. New field explanations also
use the selected language; curated source material and linked resources retain
their original language. The
French copy is a draft and needs review by a fluent speaker.

The landing page's service-directory and illustrative margin-note links open
the corresponding official English or French pages for the selected language,
including localized department abbreviations. The bundled PPTC 153 sample
remains English and is labeled accordingly in French.
Each PDF can be up to 10 MB (10 × 1024 × 1024 bytes), inclusive, with up to
five documents open at once. Use blank, fillable PDFs; scanned, flattened,
password-protected and XFA-only forms are not supported for field explanations.
The header and browser tab share the highlighted-paper logo.

Choose **Start with just chat** on the landing page to ask questions without a
PDF. **Add PDF** in chat opens the existing document preview, fields and details
panels, carrying the conversation into the form's **Ask** tab. An answer already
streaming continues there; it uses the context available when it was requested.
Closing the last PDF in a chat-started session returns to chat and keeps that
document's conversation. **New session** clears the chat and documents and returns
to the landing page.

The landing page carries over **design concept 1 (Marginalia)**: a blank study
copy with field-linked margin notes, a folded-paper upload area, and a searchable
directory of official services. **Start with just chat** opens the question-and-answer
tool for government-service questions, with or without a form. The document
workspace keeps the Paper Route layout. The preview is illustrative, not an
editable form; the working sample opens the bundled English PPTC 153.

On landing-page load, the two preview sheets slide over one another and settle
into the existing paper stack, followed by a brief highlighter swipe.
The surname, date-of-birth and travel-date notes fade in with a subtle 8px
left-to-right slide and a short stagger, paired with their connector lines. They stay
hidden until fonts have loaded and the paper entrance has settled, then appear
after a brief pause, sliding only the final few pixels into place. With JavaScript
disabled, the notes remain readable as a spaced list.
Controls use short colour transitions and the upload icon nudges on hover or
keyboard focus. Nothing loops; reduced-motion
preferences skip the pause and fades and show the final notes once layout is ready.

On desktop, drag either divider beside the document to resize the fields and
details panels. You can also focus a divider and use the arrow keys, or
double-click it to restore its adjacent panel's default width. On smaller
screens the workspace stays stacked. The button at the top-right of the fields
sidebar collapses it to a narrow rail; the same button expands it back to its
previous width, keeping its search and filters. Selecting a field sweeps its
heading's highlight from left to right (unless reduced motion is enabled); long Next
labels truncate instead of wrapping.

### Environment configuration

For the web application, copy [web/.env.example](web/.env.example) from `web/`
only if you do not already have `.env.local`:

```sh
cp -n .env.example .env.local
```

Set `OPENAI_API_KEY` in that ignored local file or in your deployment's
server-side secret store. The default `AI_PROVIDER=openai` uses
`OPENAI_MODEL=gpt-6-luna`. To use Gemini instead, set `AI_PROVIDER=gemini` and
`GEMINI_API_KEY` to a Google AI Studio key; `GEMINI_MODEL` optionally overrides
`gemini-3.1-flash-lite`. A key for the unselected provider is not required and
is never used as an automatic fallback. Invalid provider names return the same
configuration error as a missing key.
Set `SERPER_API_KEY` to your Serper
key for search discovery and failed mapped-page lookups. Mapped pages and
recognized downloads work without a search key if direct verification succeeds.
`web/.env` is also supported; keep existing secrets there if already configured.
Search consumes Serper credits; the selected AI provider's generation charges
and quotas apply to planning, field assistance and answers. OpenAI requests set
`store: false`; this does not change the provider's other data-retention policies.
Never prefix any key with `NEXT_PUBLIC_`.
Next.js loads `.env*` from `web/`, with `.env.local` taking precedence over
`.env`; restart the server after changing configuration. Never commit actual
credentials. The root [.env.example](.env.example) lists the same variable names
for reference; the running app does not load environment files from the root.

Chat has a 60-second deadline. A missing selected-provider key returns 503; a provider
startup failure before streaming returns 502, and deadline expiry before
streaming returns 504. After a failed direct attempt, Google search quota
exhaustion produces an explicit `grounding_quota` state with the original
failure reason, not an ungrounded answer. Search failures and post-start
generation failures are reported through typed SSE events, and any partial
answer is marked incomplete. New session and document removal abort their
pending chats. This hackathon endpoint still needs deployment-level
access controls and rate limits before public exposure.

## Collaboration

- Name new work branches `feature/short-description`, using lowercase words
  separated by hyphens, for example `feature/project-setup`.
- Keep pull requests focused. Describe the change and how it was verified.
- Record important trade-offs in [docs/decisions/](docs/decisions/) and supporting
  evidence in [docs/research/](docs/research/).
- Follow [AGENTS.md](AGENTS.md) when working with coding assistants.

### Opening a pull request on GitHub

1. Start a new `feature/short-description` branch from the latest default branch.
   Commit your focused changes and push the branch to GitHub. If this is the
   branch's first push, use `git push -u origin <your-branch-name>`, replacing
   the placeholder with your actual branch name.
2. Open [the repository](https://github.com/Sippiez/TEAM-H) on GitHub, then select
   **Pull requests > New pull request** (or **Compare & pull request** if shown).
3. Set **base** to the branch that should receive the changes, normally the
   default branch, and **compare** to your work branch.
4. Review the diff, select **Create pull request**, and give it a descriptive
   title. Fill in the template's summary, changes, verification, and other
   sections. Use "Not applicable" where appropriate; do not claim checks you
   did not run.
5. Request a teammate's review, address feedback, and merge once required reviews
   and checks are satisfied. Use a draft PR if the work is not ready for review.

GitHub automatically pre-fills new PR descriptions from
[.github/pull_request_template.md](.github/pull_request_template.md) once that
file is merged into the repository's default branch. For the initial setup PR,
or a PR that is already open, copy the template into the description manually.
Adding the template does not update existing PR descriptions or enforce its
checklist; required reviews and checks are configured separately in GitHub.

## Generate Codebase Context
When GitHub Copilot is unavailable, use this script to combine selected files into a single text file:

```bash
# Make sure that you give the bash script execution perms first
chmod u+x copy-codebase.sh
```
```bash
# Usage example
./copy-codebase.sh web
```

The script includes tracked text files only, skips binary and ignored files, and labels each file with its repository-relative path.


## Repository layout

- [AGENTS.md](AGENTS.md): guidance for coding assistants.
- [copy-codebase](copy-codebase.sh): use this for chatting with copilot chat online
- [.github/pull_request_template.md](.github/pull_request_template.md): shared
  pull request description and checklist.
- [.gitignore](.gitignore): generic local-file and secret exclusions.
- [.env.example](.env.example): safe environment configuration template.
- [docs/decisions/](docs/decisions/): decision records.
- [docs/research/](docs/research/): research notes and sources.
- [web/](web/): Next.js app for the formER MVP.
- [DESIGN.md](DESIGN.md): the visual system (Paper Route workspace, decision 0003,
  and the concept 1 Marginalia landing page).
- [design-explorations/](design-explorations/): six static UI direction
  prototypes. Direction 1, `01-marginalia.html`, is the landing-page reference;
  direction 6, `06-paper-route.html`, is the workspace reference.
  Open `index.html` through a local static
  server, for example `python3 -m http.server --directory design-explorations`.
- [.agents/skills/](.agents/skills/): existing reusable agent workflows.
