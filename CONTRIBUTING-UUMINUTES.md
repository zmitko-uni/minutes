# Contributing to Minutes

Minutes is a fork of [Signal Desktop](https://github.com/signalapp/Signal-Desktop). These guidelines apply to **Minutes-specific** changes.

## Before you start

1. Read **[docs/FORK-MAINTENANCE.md](docs/FORK-MAINTENANCE.md)** — fork must stay mergeable with upstream Signal.
2. Put new logic in **`ts/uuminutes/`** (or `app/uuminutes_*.main.ts` for main process).
3. Upstream files: **thin hooks only** — document every touch in **[docs/UUMINUTES-PATCHES.md](docs/UUMINUTES-PATCHES.md)**.

## Pull requests

- Open a PR against `main` on [zmitko-uni/minutes](https://github.com/zmitko-uni/minutes).
- **Minutes CI** must pass (`check:types` after `generate`).
- Keep diffs focused; avoid formatting or renaming Signal code.
- Update **user docs** if behavior changes: `images/uuminutes/prirucka.md`, optionally `CHANGELOG.md` under `[Unreleased]`.

## Reporting issues

Use GitHub issue templates (**Minutes — chyba** / **návrh funkce**).  
For Signal service problems (login, delivery), use [Signal support](https://support.signal.org/) — not this repo.

## Releases (maintainers)

1. Update **`CHANGELOG.md`** — move items from `[Unreleased]` to the new version section.
2. **Actions → Release Minutes** — bumps version, typechecks, builds installer, publishes GitHub Release.
3. Release notes are generated from `CHANGELOG.md` via `scripts/extract-changelog-release.mjs`.

## License

Contributions are under **AGPL-3.0-only**, same as Signal Desktop.
