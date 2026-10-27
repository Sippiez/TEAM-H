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

### Setup and validation (to be filled in)

- **Prerequisites and versions:** TODO after stack selection.
- **Dependency installation:** TODO.
- **Run locally:** TODO.
- **Tests, linting, and build:** TODO.
- **Deployment:** TODO.

There are no application, build, or test commands yet.

### Environment configuration

[.env.example](.env.example) is a comment-only template until configuration is
needed. Add variable names, safe example values, and descriptions as they are
introduced. If the chosen tooling uses a local `.env` file, copy the template:

```sh
cp .env.example .env
```

Keep actual credentials in your local environment or an approved secret store,
never in Git. Update this section with the chosen tooling's configuration steps;
copying the file alone does not load it.

## Collaboration

- Name new work branches `feature/short-description`, using lowercase words
  separated by hyphens, for example `feature/project-setup`.
- Keep pull requests focused. Describe the change and how it was verified.
- Record important trade-offs in [docs/decisions/](docs/decisions/) and supporting
  evidence in [docs/research/](docs/research/).
- Follow [AGENTS.md](AGENTS.md) when working with coding assistants.

## Repository layout

- [AGENTS.md](AGENTS.md): guidance for coding assistants.
- [.gitignore](.gitignore): generic local-file and secret exclusions.
- [.env.example](.env.example): safe environment configuration template.
- [docs/decisions/](docs/decisions/): decision records.
- [docs/research/](docs/research/): research notes and sources.
- [.agents/skills/](.agents/skills/): existing reusable agent workflows.
