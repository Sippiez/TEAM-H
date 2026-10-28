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
- **Install:** `cd web && npm install`
- **Run locally:** `npm run dev`, then open <http://localhost:3000>. Choose
  **Try the adult passport application (PPTC 153)** to use the bundled sample.
- **Checks:** `npm run typecheck`, `npm run lint` and `npm run build`.
- **Deployment:** TODO.

`predev` and `prebuild` copy the pdf.js worker into `web/public/` (it's
gitignored). There are no automated tests yet.

If you're behind a TLS-inspecting proxy, `next/font` and npm can fail to
download. Point Node at your organisation's root CA instead of disabling TLS
verification:

```sh
export NODE_EXTRA_CA_CERTS=/path/to/your-root-ca.pem
```

The assistant is a rule-based demo. No AI model or API key is needed yet.

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

## Repository layout

- [AGENTS.md](AGENTS.md): guidance for coding assistants.
- [.github/pull_request_template.md](.github/pull_request_template.md): shared
  pull request description and checklist.
- [.gitignore](.gitignore): generic local-file and secret exclusions.
- [.env.example](.env.example): safe environment configuration template.
- [docs/decisions/](docs/decisions/): decision records.
- [docs/research/](docs/research/): research notes and sources.
- [web/](web/): Next.js app for the Form Helper MVP.
- [DESIGN.md](DESIGN.md): the chosen visual system (Paper Route, decision 0003).
- [design-explorations/](design-explorations/): six static UI direction
  prototypes. Direction 6, `06-paper-route.html`, is the chosen reference.
  Open `index.html` through a local static
  server, for example `python3 -m http.server --directory design-explorations`.
- [.agents/skills/](.agents/skills/): existing reusable agent workflows.
