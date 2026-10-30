# Decisions

Record significant choices here, including the eventual technology stack.
Use one file per decision, named `NNNN-short-description.md`, starting at `0001`.
Keep records brief and link to supporting [research](../research/).

## Records

- [0001: Web stack and UI kit](0001-web-stack-and-ui-kit.md) - Accepted.
- [0002: Government Form Helper MVP scope and delivery gates](0002-government-form-helper-mvp.md) -
  Accepted design baseline; implementation and provider approvals remain gated.
- [0003: Paper Route design direction](0003-paper-route-design-direction.md) -
  Accepted visual direction; porting into `web/` not yet authorized.
- [0004: Gemini streaming chat](0004-gemini-streaming-chat.md).
- [0005: Restricted official information search](0005-restricted-official-search.md) -
  Superseded by 0006.
- [0006: Google Search grounding](0006-google-search-grounding.md) -
  Accepted as fallback after direct lookup; successful live grounding is blocked
  by project quota.
- [0007: Automatic public-form discovery](0007-automatic-public-form-discovery.md) -
  Accepted; removes the service-catalog gate for identifiable forms and the
  service dropdown, preserving direct verification and the approved roots.

## Template

Copy this template into a new record when a decision is needed:

```markdown
# NNNN: Decision title

- Date: YYYY-MM-DD
- Status: Proposed / Accepted / Superseded
- Owner: TODO

## Context
What problem or constraint requires a decision?

## Options considered
List realistic options and their trade-offs.

## Decision
What was chosen, and why?

## Consequences
What benefits, limitations, and follow-up work result?
```
