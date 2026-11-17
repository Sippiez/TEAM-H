# Search and AI context review

- Date: 2026-11-16
- Reviewed commit: `67756529f8cfd9e39a7e4c06ae04997b61b30c48`
- Status: findings addressed on `feature/search-context-fixes`; see the
  implementation verification below. The original findings describe the reviewed
  commit before fixes.
- Scope: chat request construction, conversation scope, service/form routing,
  direct retrieval, Serper fallback, excerpt selection, Gemini prompts and
  streaming completion. The field search and context-association paths were also
  inspected. The initial review changed no application code; implementation
  updates are recorded below.

Eight reproducible bugs and one retrieval gap were found. The strongest match
for an intermittent failure is finding 1: a transient connection failure erases
the service scope used by subsequent questions. These reproductions establish
code behavior; without an example or trace of the reported incident, they do
not identify which defect caused that particular incident.

## Findings

### 1. High: an interrupted request erases the established service scope

Source: [form-helper-app.tsx:255](/Users/akib/Developer/TEAM-H/web/src/components/form-helper/form-helper-app.tsx:255).

The client takes lookup context from the most recent assistant message, even
when that message has no lookup result. An error before the lookup event
therefore hides the last usable context.

Reproduced sequence using the real client module through a simulated hook
harness, followed by the real server resolver:

1. Ask “What are passport fees?” and receive a passport lookup result.
2. Ask “What documents do I need?” and interrupt the response before lookup.
3. Ask “What about the fees?”

The third payload contains `lookupContext: {}`. The resolver returns
`selection: null, reason: "missing_service"`. It inspects only the most recent
user turn for history-based recovery, which also lacks the service name.

Recommendation: persist the current validated scope as session state independent
of response messages. Preserve it through failures and reset it deliberately
when the subject or document changes. Otherwise, users must repeat context
after an unrelated network interruption.

### 2. High: a service change can inherit an incompatible jurisdiction

Source: [context.ts:135](/Users/akib/Developer/TEAM-H/web/src/lib/official/context.ts:135).

After a federal passport question, “What about a health card?” resolves to:

```json
{"serviceId":"health_card","jurisdiction":"federal","facetId":"overview","language":"en"}
```

The resolver reports `reason: "none"`. The follow-up cue allows the prior
jurisdiction to survive even though the service changed. Search is consequently
restricted to `canada.ca`, excluding the provincial and territorial sources
needed for a health card.

Recommendation: check service/jurisdiction compatibility before reusing scope;
ask for a province or territory when moving from a federal service to a
provincial service without an explicit region.

### 3. High: passport renewal questions retrieve new-application instructions

Sources: [resources.ts:360](/Users/akib/Developer/TEAM-H/web/src/lib/catalog/resources.ts:360),
[lookup.ts:88](/Users/akib/Developer/TEAM-H/web/src/lib/official/lookup.ts:88),
[lookup.ts:324](/Users/akib/Developer/TEAM-H/web/src/lib/official/lookup.ts:324).

“How do I renew my passport?” resolves to the generic passport `steps` facet.
Its direct candidates are exclusively:

```text
.../canadian-passports/new-adult-passport.html
.../canadian-passports/new-adult-passport/apply-submit-fees.html
```

In a fixture-backed execution of the real fallback coordinator, pages describing
only a new adult application are accepted as `verified / official_page`.
Relevance checks require a passport keyword, not renewal instructions, so
successful retrieval suppresses Serper fallback. This can produce irrelevant
guidance or an answer that cannot address renewal; a live wrong answer was not
claimed or tested.

Recommendation: retain the requested operation, such as renewal versus a new
application, through routing and evidence selection. Verify that retrieved
material addresses that operation before ending discovery.

### 4. Medium: form numbers embedded in questions bypass automatic discovery

Sources: [context.ts:48](/Users/akib/Developer/TEAM-H/web/src/lib/official/context.ts:48),
[gemini.ts:288](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:288).

The control message `CIT 0001` correctly creates a public-form identity.
“Where can I download CIT 0001?” does not. Generic number validation runs on
the entire message, while in-sentence recognition covers only registered forms.
The planner cannot express an unregistered form through its service-enum tool.

With a schema-compliant planner response identifying an unsupported service,
the real chat generator returns `clarification_required / missing_service`
and dispatches zero lookups. Users must know to send the number separately.

Recommendation: extract and validate bounded public-form references from the
question before falling back to catalog-only planning, retaining ambiguity
checks when multiple numbers are present.

### 5. Medium: ordinary paraphrase follow-ups discard the service and facet

Sources: [context.ts:98](/Users/akib/Developer/TEAM-H/web/src/lib/official/context.ts:98),
[gemini.ts:436](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:436).

After “What are passport fees?”, the resolver receives both the previous
question and valid passport/fees context. “Can you explain that in simpler
words?” nevertheless returns only `{"facetId":"overview"}` with
`missing_service`. The follow-up regex recognizes “that form” and “it”, but not
the standalone “that” in this request.

The recovery planner sees the current sentence and the already-depleted public
context, without the earlier question, so it cannot reliably restore the
missing subject. This is independent of the network-error bug in finding 1.

Recommendation: resolve references against explicit conversation state rather
than a narrow set of prefixes. Preserve the prior information facet for
requests to explain or rephrase the previous answer.

### 6. Medium: jurisdiction clarification loses the original answer question

Sources: [context.ts:54](/Users/akib/Developer/TEAM-H/web/src/lib/official/context.ts:54),
[gemini.ts:352](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:352).

For “What documents do I need to apply for a health card?” followed by
“Ontario”, routing correctly chooses Ontario and the documents facet. However,
the final answer prompt contains `CURRENT_QUESTION: Ontario`; the original
question is absent. The helper reconstructs previous questions only for form
identity replies, not jurisdiction replies. The generic facet remains, but
details of the user's actual question are lost.

Recommendation: retain a pending question through clarification and reconstruct
it for answer generation. Keep it separate from public search arguments so
conversation text is still never sent to Serper.

### 7. Medium: selected-field follow-ups are misrouted into service search

Sources: [gemini.ts:272](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:272),
[gemini.ts:423](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:423).

An explicit field explanation correctly receives the selected signature field's
printed instruction: “Leave this box blank until the officer asks you to sign.”
With the same selected field, “Can I leave it blank?” instead dispatches a
passport-overview lookup. In the unavailable-lookup fixture, no answer-generation
call is made at all. Even with successful retrieval, the official-answer prompt
does not contain the selected field or its printed instruction.

Recommendation: resolve field-related intent using the active selection and
conversation before deciding whether live information is needed. Retain the
selected field's bounded evidence in an answer that concerns that field.

### 8. Medium: token-truncated AI answers are reported as complete

Sources: [gemini.ts:413](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:413),
[gemini.ts:532](/Users/akib/Developer/TEAM-H/web/src/lib/ai/gemini.ts:532),
[route.ts:243](/Users/akib/Developer/TEAM-H/web/src/app/api/chat/route.ts:243).

Both answer generators consume text without checking provider finish reasons.
The route treats ordinary iterator exhaustion as successful completion.

Injecting a Gemini chunk with text `An unfinished answer because` and
`finishReason: "MAX_TOKENS"` through the real chat route yields:

```json
{"version":1,"type":"delta","text":"An unfinished answer because"}
{"version":1,"type":"complete","complete":true}
```

The UI therefore receives no indication that the answer was cut off and does
not offer its incomplete-response recovery for this condition.

Recommendation: inspect terminal provider status in both generation paths and
propagate incomplete completion through the existing typed error events.

### 9. Medium retrieval gap: relevant facts can be cut out of verified evidence

Source: [lookup.ts:128](/Users/akib/Developer/TEAM-H/web/src/lib/official/lookup.ts:128).

For a service lookup without a specific form reference, the excerpt always
starts at character zero and stops at 4,000 characters. It is not centered on
the requested information facet.

A fixture page within the fetcher's text limit contains introductory passport
material followed by the fee fact after character 5,000. Lookup returns
`verified`, but the 4,000-character evidence contains no fee fact. The answer
model cannot use it, and a verified direct result prevents search fallback.

The failure is deterministic for this page layout; its frequency on current
government pages was not measured. Bounded context is appropriate, but the
selection strategy discards the useful content before applying that bound.

Recommendation: select relevant sections before clipping, and distinguish
successful page retrieval from evidence sufficient to answer the question.

## Verification and limits of the initial review

- The initial `cd web && npm test` attempt failed during module loading because
  local dependencies, including TypeScript, are absent. This was not a set of
  failing application assertions.
- Nine existing isolated test files then passed **181 tests** using Node
  **24.22.2** and a temporary ESM resolver pointing to already-installed global
  TypeScript **4.9.5**. This is supplemental runtime verification, not a check
  using the project's lockfile-pinned dependencies.
- A separate temporary regression harness ran **11 cases: two passing controls
  and nine intentionally failing assertions**, one per finding. The renewal
  case was additionally checked through the real fallback coordinator.
- The client reproduction uses the repository's existing simulated-hook
  approach with a minimal JSX object factory. It does not constitute a browser
  or React integration test. Server reproductions execute the real modules;
  Gemini, page bodies, and connection failures are controlled fakes.
- No live Gemini or Serper requests, government-page requests, credentials,
  login prompts, dependency installs, typecheck, lint, or production build were
  used. Provider quota, TLS behavior, and the exact reported incident remain
  unverified in this review.
- At the initial-review stage, the only repository addition was this report;
  fixes were applied in the subsequent implementation described below.

Temporary local evidence is available in the
[reproduction cases](/private/tmp/team-h-review-cases.cjs),
[module harness](/private/tmp/team-h-review-repro.cjs),
[client harness](/private/tmp/team-h-review-client.cjs),
[test resolver](/private/tmp/team-h-review-loader.mjs),
[reproduction output](/private/tmp/team-h-review-repros.log), and
[baseline test output](/private/tmp/team-h-review-targeted-tests.log).
These files are outside the repository and may be removed by temporary-file
cleanup. The scenarios and observed results above are the durable evidence.

Run the temporary regression cases with:

```sh
/Users/akib/.nvm/versions/node/v24.22.2/bin/node --test /private/tmp/team-h-review-cases.cjs
```

The initial run exited with status 1. After the fixes, all eleven temporary
cases pass. The temporary harness was adapted to the newly added component
tests and now expects new-application-only evidence to be rejected for renewal.

## Recommended order

Fix scope preservation and incompatible jurisdiction inheritance first, then
renewal routing. Address question reconstruction, embedded form identities, and
selected-field routing next. Add terminal-status handling and improve excerpt
selection. Preserve the privacy boundary throughout: conversational context can
inform the AI answer without becoming raw search-provider input.

## Implementation verification

All nine findings have corresponding fixes and regression coverage. The browser
review also found and verified a related precedence bug: a new form identity in
“Where can I download CIT 0001 in Canada?” could lose to an earlier health-card
scope. A new regression failed before the precedence correction and passes now.

- Current scope persists independently of display messages, across interrupted
  and field-only answers and chat/PDF transitions, with per-document isolation.
- Provincial services discard incompatible federal scope; clarification and
  rephrase requests retain the referenced user question.
- Explicit public form references replace prior service scope. Generic
  identifiers need an explicit form label; extracted identities, rather than
  arbitrary question text, enter canonical search queries.
- Validated passport renewal mode reaches direct retrieval, fallback, excerpts,
  the answer prompt, follow-ups and saved recovery links. New-application paths
  are rejected for renewal even if their text mentions a renewal link.
- Selected-field blank follow-ups retain the selected metadata. Terminal
  non-success generation states produce incomplete typed responses and retry.
- Fixed facet cues retain later facts within the 4,000-character evidence bound.

Four T3-owned implementation workers used `gpt-6.1-terra`: High effort for the
resolver and retrieval tickets, Medium for client state and AI handling. The
main agent reviewed the patches, made integration corrections, and independently
ran validation. Removing the terminal-status guard caused its new regression to
fail; the original guard was restored afterward.

Using Node.js 24.22.2 and the repository's installed lockfile dependencies:

- `cd web && npm test`: **265 tests passed**.
- `npm run lint`: passed.
- `npm run typecheck`: passed. Its new `pretypecheck` hook generates the Next.js
  route types required on a fresh checkout, avoiding a separate manual step.
- `npm run build`: passed, including TypeScript and static page generation.
- `git -c core.whitespace=cr-at-eol diff --check`: passed. Existing CRLF source
  conventions were retained.
- The initial full suite exposed two pre-existing landing assertions expecting
  the old privacy placement and Google Search retention copy. They now check
  the actual separate disclosure panel and current Gemini/Serper privacy text.
  Product markup and copy were not changed for those assertions.

The browser review used T3's shared browser in an incognito profile. The actual
app first displayed its missing-configuration recovery for a 503 chat response.
A temporary local proxy then served the real app and chat route with controlled
model and lookup fixtures, because this checkout has no AI credentials. Verified:

1. Passport question → injected 502 before lookup → fees follow-up retained
   passport scope and returned a fixture answer.
2. Passport → health card requested a province; typed “Ontario” retained the
   earlier question in the answer prompt and selected Ontario.
3. Injected `MAX_TOKENS` retained the official-source cards and displayed retry.
4. Adding the bundled 159-field PPTC 153 carried the conversation into the PDF
   workspace. Field search, selecting Email address, asking about that field,
   and a blank-field follow-up used the same field metadata.
5. Closing the final PDF returned to chat with the conversation. An embedded
   CIT 0001 question replaced the preceding health-card scope after the fix.
6. New session cleared scope/history. Switching to French set `fr-CA` and
   localized controls; the French renewal suggestion selected renewal mode and
   requested French synthesis. Fixture answer text itself was not a translation
   quality test.

No unexpected application console exceptions were observed. The captured HTTP
errors were the unconfigured-service response and deliberate interruption.
The temporary proxy, servers and browser tab were cleaned up after the review.
No live Gemini/Serper result or government-page freshness claim was verified.

Next.js displayed a security-upgrade warning for the pinned framework version
during both dev startup and the build. The build passed after its reminder; no
dependency version was changed as part of these fixes. That warning remains a
separate dependency-maintenance follow-up.

Decision: [0009](../decisions/0009-conversation-scope-and-renewal-routing.md).
