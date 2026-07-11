# Git Rules

Scope: always loaded (cross-cutting)

- Never commit unless the user explicitly requests it.
- Never push unless the user explicitly requests it.
- Never use `--no-verify` or otherwise bypass repository hooks.
- Create a descriptive branch before committing when the current branch is `main`.
- Use scoped Conventional Commits and do not add generated-by attribution or co-authors.
