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

```bash
git checkout beta
git pull origin beta
# po merge fix commitů:
pnpm run release:minutes:beta:metadata
git add package.json CHANGELOG.md
git commit -m "chore(release): [beta] Minutes 8.21.0-m1.0.4-beta.1"
git push origin beta
```

Nebo **Actions → Release Minutes → release_channel: beta** (branch `beta`).

### 4. Test beta instalátoru

Stáhni pre-release z GitHub Releases (tag `v8.21.0-m1.0.4-beta.1`).

### 5. Promote do prod

```bash
git checkout main
git pull origin main
git merge beta
# vyřeš konflikty, pak prod release:
pnpm run release:minutes:metadata
git add package.json CHANGELOG.md
git commit -m "chore(release): Minutes 8.21.0-m1.0.5"
git push origin main
```

Po merge beta→main obvykle **prod bump** zvedne Meetup patch (`-m1.0.4-beta.3` → `8.21.0-m1.0.5`).

## Verze

- **Beta bump:** `8.21.0-m1.0.4` → `8.21.0-m1.0.4-beta.1` → `-beta.2` …
- **Prod bump:** `-mX.Y.Z` bez `-beta` (patch/minor/major v Actions)

## Pravidla forku

Při opravách z issues platí [`FORK-MAINTENANCE.md`](./FORK-MAINTENANCE.md) — logika do `ts/minutes/`, upstream jen tenké hooky.
