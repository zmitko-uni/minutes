# Minutes — beta / prod staging a opravy z issues

## Kanály

| Kanál | Branch | Verze | GitHub Release |
|-------|--------|-------|----------------|
| **Beta** | `beta` | `8.21.0-m1.0.4-beta.1` | pre-release (testování) |
| **Prod** | `main` | `8.21.0-m1.0.5` | latest stable |

Beta buildy se **neobjeví** v `/releases/latest` — prod uživatelé je neuvidí v auto-update.

## Label pro issues

V GitHubu vytvoř label (jednorázově):

```bash
gh label create "potvrzeno-k-oprave" --repo zmitko-uni/minutes --color 0E8A16 --description "Schváleno k opravě — beta flow"
```

Seznam otevřených:

```bash
pnpm run issues:confirmed
```

## Flow: issue → beta → prod

### 1. Potvrzení issue

Na GitHubu přidej label **`potvrzeno-k-oprave`**.

### 2. Oprava v Cursoru

Použij skill **`minutes-fix-confirmed-issue`** (viz `.cursor/skills/minutes-fix-confirmed-issue/SKILL.md`):

- načte issue
- analýza + fix v `ts/minutes/`
- CHANGELOG `[Unreleased]`
- commit na branch **`beta`**

### 3. Beta release

Po pushi všech fix commitů na `beta` spusť workflow (verzi bumpne CI):

```bash
pnpm run release:minutes:beta:trigger
```

Nebo **Actions → Release Minutes** → branch **`beta`**, **`release_channel: beta`**.

Ruční fallback (verzi bumpne lokálně, push `chore(release):` spustí build):

```bash
pnpm run release:minutes:beta:metadata
git add package.json CHANGELOG.md
git commit -m "chore(release): [beta] Minutes 8.21.0-m1.0.4-beta.1"
git push origin beta
```

### 3b. Označ issues k retestu

```bash
pnpm run issues:retest -- 7 8
```

Label **`to-retest`** = opraveno v beta, čeká ověření testerem. Odebere **`potvrzeno-k-oprave`**.

### 4. Test beta instalátoru

Stáhni pre-release z GitHub Releases (tag `v8.21.0-m1.0.4-beta.1`).

### 5. Promote do prod

Použij skill **`minutes-promote-beta-to-prod`** (`.cursor/skills/minutes-promote-beta-to-prod/SKILL.md`):

```bash
git checkout main && git pull origin main
git merge beta
git push origin main
pnpm run release:minutes:prod:trigger
# po úspěchu workflow:
git pull origin main
pnpm run issues:close-retest
```

Po merge beta→main obvykle **prod bump** zvedne Meetup patch (`-m1.0.4-beta.3` → `8.21.0-m1.0.5`).

## Verze

- **Beta bump:** `8.21.0-m1.0.4` → `8.21.0-m1.0.4-beta.1` → `-beta.2` …
- **Prod bump:** `-mX.Y.Z` bez `-beta` (patch/minor/major v Actions)

## Pravidla forku

Při opravách z issues platí [`FORK-MAINTENANCE.md`](./FORK-MAINTENANCE.md) — logika do `ts/minutes/`, upstream jen tenké hooky.
