## AgentKit: instructions for coding agents

This repository contains **two monorepos**:
- **Python** packages live under `python/` (each package has its own `pyproject.toml`).
- **TypeScript** packages live under `typescript/` (workspace managed by Turborepo + pnpm).

Use this file as the “ground truth” for how an automated coding agent should navigate, change, and validate work in this repo.

### Scope and where to work

- **Prefer small, targeted changes** in the *specific package* you’re modifying (don’t “fix” unrelated formatting or refactor across both languages).
- **Not all functionality exists in both languages.** Don’t assume a Python change implies a TypeScript change (or vice versa).
- **Add docs next to code**: most documentation is colocated `README.md` files in the relevant package/folder.

### Safety and hygiene

- **Never commit secrets** (API keys, `.env` contents, private keys, etc.). Keep example env files as `.env.local`/templates where applicable.
- **Avoid long-running processes** (e.g. `pnpm dev`, `tsc --watch`). Prefer one-shot `build`, `lint`, `test`.
- **Don’t broaden test scope unnecessarily**: run the narrowest checks that cover your change.

### Repository map (high-signal paths)

- **Python core package**: `python/coinbase-agentkit/coinbase_agentkit/`
- **Python action providers**: `python/coinbase-agentkit/coinbase_agentkit/action_providers/`
- **Python wallet providers**: `python/coinbase-agentkit/coinbase_agentkit/wallet_providers/`
- **Python tests**: `python/coinbase-agentkit/tests/`
- **TypeScript core package**: `typescript/agentkit/src/`
- **TypeScript action providers**: `typescript/agentkit/src/action-providers/`
- **TypeScript wallet providers**: `typescript/agentkit/src/wallet-providers/`
- **TypeScript examples**: `typescript/examples/`

### Python workflows (uv + make)

Run these commands **from the package directory** you changed (for example, `python/coinbase-agentkit/`).

#### Install

```bash
make install
```

#### Format and lint

```bash
make format
make lint
```

If you need autofixes:

```bash
make lint-fix
```

#### Tests

For `python/coinbase-agentkit/`, unit tests exclude e2e/integration markers by default:

```bash
make test
```

Optional (only if your change affects these):

```bash
make test-integration
make test-e2e
```

#### Docs

If you changed public APIs, update docs and regenerate API docs if needed:

```bash
make docs
```

### TypeScript workflows (pnpm + turbo)

#### Install (workspace)

Run from `typescript/`:

```bash
pnpm install
```

#### Build / lint / test (workspace)

Also from `typescript/`:

```bash
pnpm build
pnpm lint
pnpm test
```

#### Package-level commands (when you only touched one package)

For `typescript/agentkit/` specifically, the package scripts include:

```bash
pnpm -C typescript/agentkit build
pnpm -C typescript/agentkit lint
pnpm -C typescript/agentkit test
pnpm -C typescript/agentkit format
```

### Adding a new Action Provider

#### Python

- Action providers live in `python/coinbase-agentkit/coinbase_agentkit/action_providers/`.
- Prefer generating a new provider using the package helper:

```bash
cd python/coinbase-agentkit
make generate-action-provider
```

#### TypeScript

- Action providers live in `typescript/agentkit/src/action-providers/`.
- Prefer generating a new provider using:

```bash
pnpm -C typescript/agentkit generate:action-provider
```

### Changelog expectations

Only add a changelog entry when you are making a user-facing change (feature, bugfix, behavior change).

- **Python** uses `towncrier` fragments under `python/**/changelog.d/` (see `CONTRIBUTING-PYTHON.md`).
- **TypeScript** uses **Changesets** under `typescript/.changeset/` (see `CONTRIBUTING-TYPESCRIPT.md`).

### PR expectations (what reviewers will look for)

- **Clear description** and **why** the change is needed.
- **Tests**: include what you ran and, when relevant, a short manual test transcript (see `.github/pull_request_template.md`).
- **Docs**: update relevant `README.md`/docstrings when behavior changes.

### When you’re unsure

- Prefer aligning with existing patterns in the nearest neighboring file/folder.
- Follow `CONTRIBUTING.md`, `CONTRIBUTING-PYTHON.md`, and `CONTRIBUTING-TYPESCRIPT.md` over inventing new workflows.

