# TEAM-H

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

- **Prerequisites:** Node.js 20.9 or later and npm (verified with the Node
  version managed by nvm in WSL Ubuntu 24.04).
- **Install:** `cd web && npm ci`
- **Run locally:** `npm run dev`, then open <http://localhost:3000>. Choose
  **Adult passport application** under **Try a sample form** to use the bundled adult passport
  application (PPTC 153).
- **Checks:** `npm test`, `npm run typecheck`, `npm run lint` and `npm run build`.
- **Deployment:** TODO.

`predev` and `prebuild` copy the pdf.js worker into `web/public/` (it's
gitignored). `npm test` uses Node's built-in runner and the existing TypeScript
compiler to exercise chat validation, prompts, typed streaming, errors, timeouts,
cancellation, URL policy, Google grounding metadata, query privacy, and provenance using
isolated fakes, plus message/document identity across Fast Refresh; it needs no
API key or network.

If you're behind a TLS-inspecting proxy, `next/font` and npm can fail to
download. Point Node at your organisation's root CA instead of disabling TLS
verification:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/your-root-ca.pem
```

Chat uses server-side Gemini streaming and needs `GEMINI_API_KEY` (see below).
The default is the stable `gemini-3.1-flash-lite`, with low reasoning effort
to limit cost and latency. It is the cheapest stable thinking model verified
accessible with the configured account; older 2.5 models returned 404.
See [decision 0004](docs/decisions/0004-gemini-streaming-chat.md).
Field-panel explanations remain rule-based and work without a key.

Service navigation uses **direct official-page lookup first**, with **Google
Search grounding only as a fallback**. Recognized download questions fetch
their registered official information page without a search key. Without a
Brave key, mapped federal services and Saskatchewan Student Aid use their
mapped official pages. An optional `BRAVE_SEARCH_API_KEY` enables broader
candidate discovery, followed by the same direct verification. Successful
direct lookups use freshly retrieved excerpts and normal Gemini synthesis;
they never consume Google Search grounding quota.

If direct lookup fails or finds no usable evidence, it tries Google Search
grounding through the existing `@google/genai` SDK and `GEMINI_API_KEY`.
Clarification and user cancellation do not start a fallback. No Vercel AI SDK
migration is needed. Search requests contain only fixed catalog service/facet
keywords, the chosen jurisdiction, interface language and recognized public form
references, not chat history, filenames, PDF fields, entered values or arbitrary
user wording. Google generates its grounding queries from that public context.
Service selection and ordinary chat still receive the bounded context described
in the privacy notice.

For the Google fallback, the app requires actual search/citation metadata, a complete response
and the associated Search Suggestions. It displays the Google-grounded answer
with numbered citations, without a second model synthesis or silent memory
fallback. Sources are labeled **Google Search grounded**, not as pages fetched
and checked directly by the app. Source language is not guessed from the answer
language. Google Search Suggestions are displayed in a sandboxed, script-disabled
frame beside the answer.
Google retains grounding requests, context and responses for 30 days. Grounding
can involve multiple provider-generated queries and separate charges. Review
current Google pricing, data handling and service terms before deployment; see
[decision 0006](docs/decisions/0006-google-search-grounding.md).

Recognized form IDs and conversation-scoped service selections resolve questions
such as "Where do I download this form?" and "What about the fees?". Federal
programs do not require users to repeat "federal". When a service or region is
missing, an inline selector asks only for the missing detail and resumes the
original question. A typed, recognized form number also resumes the previous
question, rather than restarting service selection. OAS/GIS and CPP have distinct
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

A Google-grounded response citing excluded, sign-in or wrong-jurisdiction
sources is rejected as a whole; its text is not selectively rewritten.
Google-generated `site:` queries are a prompt constraint, not a
provider-enforced allowlist. The application enforces source admission afterward.
The Google fallback's only citation-resolution request is a manual HEAD request
to Google's fixed `vertexaisearch.cloud.google.com/grounding-api-redirect/`
endpoint. It checks the destination without following the redirect or contacting
the government page, and preserves Google's citation link for the user.
Google citation URLs are transport references, not additional approved content
roots. Arbitrary redirects and excluded `.gc.ca` sources remain blocked.

The total chat deadline remains 30 seconds. Direct lookup has a 10-second
sub-budget, at most five candidates, three page requests, two concurrent requests
and three redirects per page. Google fallback has a 20-second sub-budget under
the same overall deadline, at most eight source entries and bounded
answer/metadata sizes. Google-grounded pages do not receive independent archive
or download checks, and Google may not have read their latest complete content.
Source labels distinguish direct retrieval from Google grounding; fallback
metadata preserves the original direct failure. Saved guidance stays separately
labeled and never becomes live evidence.

Switching to mobile data/hotspot may avoid a network's TLS-inspecting proxy.
The application does not change networking or trust stores, and does not
disable certificate verification. If direct retrieval still fails and Google's
quota is exhausted, both attempts are reported as unavailable.
Interrupted responses preserve partial text and sources, mark the answer
incomplete, and provide retry; missing setup is not disguised as a retryable
network problem. Suggestions and recovery controls follow the interface language.
Starter suggestions yield space after the first question. Expandable AI/search
privacy details and a scrollable panel preserve a readable mobile answer area;
the personal-information warning remains visible in the shared header, rather
than repeated beneath each chat input.

PDF bytes and entered field values stay in the browser. Chat shares bounded
form and field metadata (including the filename), the selected field, and recent
messages with the external AI provider. Do not include personal information in
chat, filenames or field labels. Responses are not official guidance and can be
wrong; verify government requirements using the linked official guide.

You can keep up to five PDFs open as document tabs. **Add PDF** opens
another, and each tab has its own close button. The button to the left of
**New session** switches the interface between English and French, and the
choice is saved in the browser. New chat answers use the interface language at
request time; existing answers are not retranslated. Curated field explanations
and linked resources stay in English. The
French copy is a draft and needs review by a fluent speaker.

The landing page carries over **design concept 1 (Marginalia)**: a blank study
copy with field-linked margin notes, a folded-paper upload area, and a searchable
directory of official services. **Ask the service navigator** expands the
existing question-and-answer tool. The document workspace keeps the Paper Route
layout. The preview is illustrative, not an editable form; the working sample
opens the bundled English PPTC 153.

On landing-page load, the two preview sheets slide over one another and settle
into the existing paper stack, followed by a brief highlighter swipe. Controls
use short colour transitions, the upload icon nudges on hover or keyboard focus,
and the service navigator fades in when opened. Nothing loops; reduced-motion
preferences show the final composition immediately and remove these transitions.

On desktop, drag either divider beside the document to resize the fields and
details panels. You can also focus a divider and use the arrow keys, or
double-click it to restore its adjacent panel's default width. On smaller
screens the workspace stays stacked. Selecting a field sweeps its heading's
highlight from left to right (unless reduced motion is enabled); long Next
labels truncate instead of wrapping.

### Environment configuration

For the web application, copy [web/.env.example](web/.env.example) from `web/`
only if you do not already have `.env.local`:

```sh
cp -n .env.example .env.local
```

Set `GEMINI_API_KEY` to a Google AI Studio key in that ignored local file or in
your deployment's server-side secret store. Successful direct-page lookup needs
ordinary Gemini generation, not Google Search quota. For the Google fallback,
the key's project must have grounding access and sufficient quota/billing.
Ordinary Gemini generation working does not prove that search quota is
available. `BRAVE_SEARCH_API_KEY` is optional for broader first-attempt
discovery; mapped pages and recognized downloads work without it.
`GEMINI_MODEL` optionally overrides
`gemini-3.1-flash-lite`. Never prefix any key with `NEXT_PUBLIC_`.
Next.js loads `.env.local`; restart the server after changing it. Never commit
actual credentials. The root [.env.example](.env.example) remains a generic
workspace template, not the web app's configuration.

Chat has a 30-second deadline. Missing `GEMINI_API_KEY` returns 503; a Gemini
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
- [web/](web/): Next.js app for the Form Helper MVP.
- [DESIGN.md](DESIGN.md): the visual system (Paper Route workspace, decision 0003,
  and the concept 1 Marginalia landing page).
- [design-explorations/](design-explorations/): six static UI direction
  prototypes. Direction 1, `01-marginalia.html`, is the landing-page reference;
  direction 6, `06-paper-route.html`, is the workspace reference.
  Open `index.html` through a local static
  server, for example `python3 -m http.server --directory design-explorations`.
- [.agents/skills/](.agents/skills/): existing reusable agent workflows.
