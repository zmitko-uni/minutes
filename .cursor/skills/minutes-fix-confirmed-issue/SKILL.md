---
name: minutes-fix-confirmed-issue
description: >-
  Fixes GitHub issues labeled potvrzeno-k-oprave for Minutes (Signal fork):
  list issues, analyze, implement fix in ts/minutes/, update CHANGELOG,
  commit to beta branch, prepare beta release. Use when the user mentions
  confirmed issues, potvrzeno k opravě, beta release, or staging fixes.
---

# Minutes — oprava potvrzeného issue (beta flow)

## Před startem

1. Přečti [`docs/FORK-MAINTENANCE.md`](../../../docs/FORK-MAINTENANCE.md) a [`docs/BETA-STAGING.md`](../../../docs/BETA-STAGING.md).
2. Branch **`beta`** — fix commituj sem, ne na `main`.
3. Label issue: **`potvrzeno-k-oprave`**.

## Krok 1 — Vyber issue

```bash
pnpm run issues:confirmed
```

Uživatel může zadat číslo (`#42`). Jinak vezmi **nejstarší** otevřené s labelem.

Načti obsah:

```bash
gh issue view <NUMBER> --repo zmitko-uni/minutes
```

## Krok 2 — Analýza

Do chatu stručně:

- repro / očekávané vs. skutečné chování
- root cause (kde v kódu)
- plán fixu (soubory v `ts/minutes/` vs. tenký upstream hook)
- rizika (merge upstream, side effects)

**Stop** a zeptej se, pokud:

- jde o upstream Signal bug bez workaroundu v `ts/minutes/`
- issue je nejasné / chybí repro
- fix by vyžadoval velký zásah upstream

## Krok 3 — Implementace

Checklist:

- [ ] Logika v `ts/minutes/` (nebo `app/minutes_*.main.ts`)
- [ ] Upstream max. tenký hook — zapsat do `docs/MINUTES-PATCHES.md` pokud dotčen
- [ ] `CHANGELOG.md` → `[Unreleased]` (Changed/Fixed, česky, pro uživatele)
- [ ] `pnpm run check:types` projde
- [ ] Žádné secrets v kódu

## Krok 4 — Commit na beta

```bash
git checkout beta
git pull origin beta
git add <soubory>
git commit -m "fix: <stručný popis> (closes #<NUMBER>)"
git push origin beta
```

## Krok 5 — Beta release (až po schválení uživatele)

Zeptej se: *„Mám připravit beta release?“*

Pokud ano:

```bash
pnpm run release:minutes:beta:metadata
git add package.json CHANGELOG.md
git commit -m "chore(release): [beta] Minutes <verze>"
git push origin beta
```

Push spustí GitHub Actions **Release Minutes** (pre-release).

## Krok 6 — Po testu beta → prod (jen na pokyn)

Na **`main`**, ne automaticky:

```bash
git checkout main && git pull
git merge beta
pnpm run release:minutes:metadata
git add package.json CHANGELOG.md
git commit -m "chore(release): Minutes <verze>"
git push origin main
```

## Co nedělat

- Necommitovat na `main` bez explicitního pokynu k prod release
- Nestahovat / nespouštět beta release bez potvrzení
- Neopravovat víc nesouvisících issues v jednom commitu
- Neměnit verzi v `package.json` ručně — použij release skripty
