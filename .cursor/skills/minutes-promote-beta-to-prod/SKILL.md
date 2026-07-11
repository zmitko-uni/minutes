---
name: minutes-promote-beta-to-prod
description: >-
  Promotes tested Minutes beta to production: merge beta into main, trigger
  Release Minutes (prod), close GitHub issues labeled to-retest. Use when the
  user mentions promote beta, beta to prod, merge beta to main, prod release,
  or closing retested issues after beta verification.
---

# Minutes — promote beta → prod

Spouštěj **až po ověření oprav** — beta instalátorem, nebo po **lokálním testu** (`pnpm run start:minutes:beta`), pokud uživatel explicitně řekne, že je připraven na prod.

Často navazuje na skill **`minutes-fix-confirmed-issue`** (volba **C** v kroku 5), nebo na pozdější pokyn uživatele po vlastním testu.

## Před startem

1. Přečti [`docs/BETA-STAGING.md`](../../../docs/BETA-STAGING.md).
2. Beta release proběhl a issues mají label **`to-retest`** (skill `minutes-fix-confirmed-issue`).
3. **`gh auth login`** — token s `repo` + `workflow`.

## Krok 1 — Seznam issues k uzavření

```bash
pnpm run issues:retest:list
```

Vypiš do chatu, která issues se po prod release zavřou.  
Uživatel může omezit seznam čísly — jinak uzavři **všechna** s labelem `to-retest`.

**Stop**, pokud:

- opravy nebyly ověřeny (uživatel ještě netestoval a neřekl „promote do prod“)
- jsou otevřené issues s `potvrzeno-k-oprave` **a** uživatel nechce přeskočit beta release — nejdřív dokonči fix flow nebo spusť beta release (`minutes-fix-confirmed-issue`, volba B)
- issues nemají `to-retest` — pokud uživatel testoval jen lokálně, nejdřív `pnpm run issues:retest -- <čísla>` (po jeho explicitním potvrzení), pak pokračuj
- běží nebo selhal poslední Release Minutes workflow

## Krok 2 — Merge beta → main

```bash
git checkout main
git pull origin main
git checkout beta
git pull origin beta
git checkout main
git merge beta
```

Po merge:

- [ ] vyřeš konflikty (priorita: kód z `beta`, verzi nech — bumpne CI)
- [ ] `pnpm run check:types` projde

```bash
git push origin main
```

**Necommituj** `chore(release):` ručně — verzi a CHANGELOG bumpne workflow.

## Krok 3 — Prod release

```bash
pnpm run release:minutes:prod:trigger
```

Alternativa: GitHub → Actions → **Release Minutes** → branch **`main`**, **`release_channel: prod`**.

Počkej na úspěch buildu:

```bash
gh run list --repo zmitko-uni/minutes --workflow=minutes-release.yml --branch=main --limit=1
gh run watch <RUN_ID> --repo zmitko-uni/minutes
```

Workflow: bumpne prod verzi (strip `-beta.N`), přesune CHANGELOG, sestaví instalátor, vytvoří **latest** release.

```bash
git pull origin main
```

## Krok 4 — Zavři issues

```bash
pnpm run issues:close-retest
```

Nebo jen vybraná:

```bash
pnpm run issues:close-retest -- 7 8
```

Skript pro každé issue:

- ověří label **`to-retest`**
- přidá komentář s prod verzí z `package.json` / posledního release
- odebere **`to-retest`**
- uzavře issue

## Krok 5 — Shrnutí do chatu

- merge commit na `main`
- odkaz na GitHub Release (latest)
- seznam uzavřených issues

## Co nedělat

- Nemergovat bez otestované bety
- Nezavírat issues před úspěšným prod workflow (build může selhat)
- Neměnit verzi v `package.json` ručně
- Nezavírat issues bez labelu `to-retest`

## Související

- Opravy z issues: skill **`minutes-fix-confirmed-issue`**
- Label flow: `potvrzeno-k-oprave` → fix na `beta` → `to-retest` → **tento skill** → closed
