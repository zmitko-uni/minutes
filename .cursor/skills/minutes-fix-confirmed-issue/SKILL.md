---
name: minutes-fix-confirmed-issue
description: >-
  Fixes ALL GitHub issues labeled potvrzeno-k-oprave for Minutes (Signal fork):
  list issues, analyze, implement fixes in ts/minutes/, update CHANGELOG,
  commit to beta, trigger Release Minutes (beta), mark issues to-retest.
  Use when the user mentions confirmed issues, potvrzeno k opravě, beta release,
  or staging fixes.
---

# Minutes — oprava potvrzených issues (beta flow)

## Před startem

1. Přečti [`docs/FORK-MAINTENANCE.md`](../../../docs/FORK-MAINTENANCE.md) a [`docs/BETA-STAGING.md`](../../../docs/BETA-STAGING.md).
2. Branch **`beta`** — fix commituj sem, ne na `main`.
3. Label issue: **`potvrzeno-k-oprave`**.

## Krok 1 — Načti všechna issues

```bash
pnpm run issues:confirmed
```

**Oprav všechna** otevřená issues s labelem `potvrzeno-k-oprave` (od nejstaršího).
Uživatel může omezit seznam čísly (`#7 #8`) — jinak ber celý výstup skriptu.

Načti detail každého:

```bash
gh issue view <NUMBER> --repo zmitko-uni/minutes
```

(Pokud `gh` není v PATH, použij GitHub API.)

## Krok 2 — Analýza (pro každé issue)

Do chatu stručně:

- repro / očekávané vs. skutečné chování
- root cause (kde v kódu)
- plán fixu (soubory v `ts/minutes/` vs. tenký upstream hook)
- rizika (merge upstream, side effects)

**Stop** a zeptej se, pokud:

- jde o upstream Signal bug bez workaroundu v `ts/minutes/`
- issue je nejasné / chybí repro
- fix by vyžadoval velký zásah upstream

## Krok 3 — Implementace (všechna issues)

Checklist pro každé issue:

- [ ] Logika v `ts/minutes/` (nebo `app/minutes_*.main.ts`)
- [ ] Upstream max. tenký hook — zapsat do `docs/MINUTES-PATCHES.md` pokud dotčen
- [ ] `CHANGELOG.md` → `[Unreleased]` (Changed/Fixed, česky, pro uživatele)
- [ ] `pnpm run check:types` projde
- [ ] Žádné secrets v kódu

Každé issue = **samostatný commit** (traceabilita `closes #N`).

## Krok 4 — Push na beta

```bash
git checkout beta
git pull origin beta
git add <soubory>
git commit -m "fix: <stručný popis> (closes #<NUMBER>)"
# … opakuj pro další issues …
git push origin beta
```

## Krok 5 — Beta release (automaticky po pushi fixů)

**Nepočívej na schválení uživatele** — spusť beta release hned po pushi všech fix commitů.

Workflow **Release Minutes** už má přepínač `release_channel: beta` (`.github/workflows/minutes-release.yml`).

```bash
pnpm run release:minutes:beta:trigger
```

Alternativa ručně: GitHub → Actions → **Release Minutes** → Run workflow → branch **`beta`**, **`release_channel: beta`**.

Workflow sám zvedne `-beta.N` verzi, přesune `[Unreleased]` v CHANGELOG, sestaví instalátor a vytvoří pre-release.

## Krok 6 — Označ issues k retestu

Po spuštění beta release přeštítkuj opravená issues:

```bash
pnpm run issues:retest -- 7 8
```

Skript:

- odebere label **`potvrzeno-k-oprave`**
- přidá label **`to-retest`** (popis: *Opraveno v beta buildu — čeká retest*)

## Krok 7 — Po testu beta → prod

Skill **`minutes-promote-beta-to-prod`** — merge `beta` → `main`, prod release, uzavření issues s `to-retest`.

## Co nedělat

- Necommitovat na `main` bez explicitního pokynu k prod release
- Nezastavovat se u prvního issue — oprav **všechna** s labelem `potvrzeno-k-oprave`
- Nemíchat nesouvisící issues do jednoho commitu
- Neměnit verzi v `package.json` ručně — release dělá workflow (nebo `release:minutes:beta:metadata` jen lokálně při ručním fallbacku)
- Nezapomenout na `issues:retest` po beta release
