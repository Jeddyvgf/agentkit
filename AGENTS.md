# Agent Guidelines

This repository contains both TypeScript and Python packages. Follow the
package-specific workflows below and prefer the local README files for
feature-specific guidance.

## Repo Layout

- `typescript/`: TypeScript monorepo (AgentKit core, extensions, examples)
- `python/`: Python packages and examples
- `assets/`, `.github/`: shared docs and automation

## TypeScript Development

Requirements: Node.js v18+ and pnpm v10.7+.

- Install deps: `cd typescript && pnpm install`
- Tests: run from the package you change, e.g. `cd typescript/agentkit && pnpm test`
- Lint/format: `pnpm run lint`, `pnpm run lint:fix`, `pnpm run format`
- Changesets: `cd typescript && pnpm run changeset` (creates files in
  `.changeset/`)

## Python Development

Requirements: Python 3.10+ and uv 0.6.0+.

- Install deps: `cd python/<package> && uv sync`
- Tests: `cd python/<package> && make test`
- Lint/format: `make lint`, `make lint-fix`, `make format` (run in package)
- Changelog: add towncrier entries in `<package>/changelog.d/` (e.g.
  `uv run towncrier create --content "Fixed a bug" 123.bugfix.md`)

## Documentation

- Update the relevant `README.md` and docstrings when behavior changes.
- For new action providers, follow existing patterns under
  `typescript/agentkit/src/action-providers` or
  `python/coinbase-agentkit/coinbase_agentkit/action_providers`.
