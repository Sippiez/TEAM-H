# Agent guidance

## Project scope

- This is a hackathon workspace with no selected topic or technology stack.
- Keep preparation stack-neutral. Do not select frameworks, install dependencies,
  or generate application scaffolding until the team requests or approves it.
- Read [README.md](README.md) for the current brief, setup, and branch convention.

## Working conventions

- Inspect existing files before editing; preserve unrelated work.
- Make focused changes that address the requested task without speculative features.
- Use `feature/short-description` for new work branches.
- Capture significant decisions in [docs/decisions/](docs/decisions/) and research
  evidence in [docs/research/](docs/research/).
- Never commit credentials or real environment values. Keep
  [.env.example](.env.example) synchronized with required configuration using
  safe placeholders.

## Validation and handoff

- No application tooling or test commands exist yet. Do not invent commands or
  report checks that were not run.
- Once tooling is selected, document verified setup and validation commands in
  [README.md](README.md) and use the smallest relevant checks for each change.
- Update related documentation when behavior or setup changes.
- Summarize changes, verification results, and remaining gaps.
