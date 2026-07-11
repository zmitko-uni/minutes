---
name: minutes-fix-confirmed-issue
description: >-
  Fixes ALL GitHub issues labeled potvrzeno-k-oprave for Minutes (Signal fork):
  list issues, analyze, implement fixes in ts/minutes/, update CHANGELOG,
  commit and push to beta. Then ASKS the user whether to trigger beta release,
  stop for local testing, or continue with minutes-promote-beta-to-prod.
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

## Krok 5 — Zeptat se: co dál? (**povinná pauza**)

Po pushi všech fix commitů **zastav** a **zeptej se uživatele**, co má následovat.
**Nespouštěj beta release automaticky.**

Použij `AskQuestion` nebo jasnou otázku v chatu. Nabídni tyto volby:

| Volba | Kdy | Co udělat |
|-------|-----|-----------|
| **A — Jen otestovat** | Chci si to nejdřív ověřit u sebe | Konec skillu. Lokálně: `pnpm run start:minutes:beta`. Issues **zůstávají** s `potvrzeno-k-oprave`. Až budeš chtít release, znovu spusť tento skill (nebo řekni „udělej beta release pro #7“) — fixy už jsou na `beta`. |
| **B — Beta release** | Fixy jsou hotové, chci instalátor pro testery | Pokračuj **krokem 6** (release) a **krokem 7** (`issues:retest`). |
| **C — Promote do prod** | Už jsem otestoval (lokálně nebo betou), chci prod | Pokračuj skillem **`minutes-promote-beta-to-prod`**. Pokud ještě neproběhl beta release a issues nemají `to-retest`, nejdřív se ujisti, že uživatel opravu opravdu ověřil; pak buď nejdřív **B**, nebo po explicitním pokynu uživatele `issues:retest` a teprve potom promote skill. |

**Default po opravě:** pokud uživatel nic neřekl, zeptej se — nevybírej za něj.

### Pokračování bez nových fixů

Uživatel může skill spustit jen kvůli release (fixy už jsou na `beta`):

- ověř `git log origin/beta` / `[Unreleased]` v CHANGELOG
- přeskoč kroky 1–4
- jdi rovnou na **krok 5** (nebo rovnou **6**, pokud uživatel explicitně chce beta release)

## Krok 6 — Beta release (jen po volbě B)

Workflow **Release Minutes** má přepínač `release_channel: beta` (`.github/workflows/minutes-release.yml`).

```bash
pnpm run release:minutes:beta:trigger
```

Alternativa ručně: GitHub → Actions → **Release Minutes** → branch **`beta`**, **`release_channel: beta`**.

Workflow sám zvedne `-beta.N` verzi, přesune `[Unreleased]` v CHANGELOG, sestaví instalátor **Minutes Beta** a vytvoří pre-release.

### Beta instalátor (paralelně s prod)

Beta build je **samostatná aplikace** vedle prod — lze mít obě nainstalované:

| | Prod | Beta |
|---|------|------|
| Aplikace | Minutes | **Minutes Beta** |
| Instalátor | `Minutes-setup-windows-x64.exe` | `Minutes-Beta-setup-windows-x64.exe` |
| Data | `%APPDATA%\Minutes` | `%APPDATA%\Minutes-Beta` |
| Aktualizace | jen prod `/releases/latest` | jen nejnovější GitHub pre-release |

Po beta release stáhni pre-release asset **`Minutes-Beta-setup-windows-x64.exe`** z tagu `v8.21.0-m1.0.x-beta.N`.

Lokální vývoj bety: `pnpm run start:minutes:beta` (oddělená složka dat).

## Krok 7 — Označ issues k retestu (jen po beta release)

```bash
pnpm run issues:retest -- 7 8
```

Skript:

- odebere label **`potvrzeno-k-oprave`**
- přidá label **`to-retest`** (popis: *Opraveno v beta buildu — čeká retest*)

## Krok 8 — Po testu beta → prod

Skill **`minutes-promote-beta-to-prod`** — merge `beta` → `main`, prod release, uzavření issues s `to-retest`.

Spouští se po volbě **C** v kroku 5, nebo kdykoli později po ověření oprav.

## Co nedělat

- Necommitovat na `main` bez explicitního pokynu k prod release
- **Nespouštět beta release bez souhlasu uživatele** (krok 5)
- Nezastavovat se u prvního issue — oprav **všechna** s labelem `potvrzeno-k-oprave`
- Nemíchat nesouvisící issues do jednoho commitu
- Neměnit verzi v `package.json` ručně — release dělá workflow (nebo `release:minutes:beta:metadata` jen lokálně při ručním fallbacku)
- Nezapomenout na `issues:retest` po beta release (krok 7)
