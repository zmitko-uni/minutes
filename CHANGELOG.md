# Changelog

Všechny významné změny v **Minutes** (fork Signal Desktop) jsou zdokumentovány zde.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verze **Meetup** odpovídají `package.json` a GitHub Releases — semver `major.minor.patch` (patch = hotfix).
V závorce UI se zobrazuje upstream Signal Desktop (`MINUTES_SIGNAL_BASE_VERSION` v `ts/minutes/version.std.ts`).

Před release doplňte sekci **[Unreleased]** (Added / Changed / Fixed). Agent / vývojář spustí
`pnpm run release:minutes:metadata`, commitne `package.json` + `CHANGELOG.md` a pushne na `main`.
GitHub Actions pak automaticky sestaví instalátor a vytvoří Release s patch notes z verzované sekce CHANGELOG.

## [Unreleased]

### Added
- (doplňte před příštím release)

### Changed
- Produktové verzování **Meetup** `1.0.0` (major / minor / patch) místo `8.21.0-alpha.*`
- Aktualizace: po kontrole se nová verze jen zobrazí, stažení až po kliknutí na Stáhnout
- Sumáře v Signal chatu: nativní formát místo markdown (`**`, `##`)
- AI prompty generují prostý text vhodný pro Signal
- Label verze: `Meetup X.Y.Z (Signal Desktop 8.21.0)`

### Fixed
- Migrace z alpha buildů: starší `8.21.0-alpha.N` správně nabídne Meetup 1.x jako novější

## [8.21.0-alpha.9] - 2026-07-10

### Changed
- Release 8.21.0-alpha.9 (viz git historie od v8.21.0-alpha.8).

## [8.21.0-alpha.8] - 2026-07-10

### Changed
- Release 8.21.0-alpha.8 (viz git historie od v8.21.0-alpha.7).

## [8.21.0-alpha.7] - 2026-07-10

### Added
- Cursor rule: agent udržuje CHANGELOG [Unreleased] při user-facing změnách
- `release:minutes:metadata` — bump verze + přesun changelog před push na main
- Release workflow se spouští automaticky po pushi s novou verzí (bez ručního Actions)

### Changed
- Release se spouští automaticky po pushi s novou verzí (bez ručního GitHub Actions)

### Fixed
- Kontrola aktualizací nerozpoznávala novější alpha verze (semver.parse místo coerce)
- TypeScript chyby v modulu přepisu hovorů

## [8.21.0-alpha.1]

Základní release na Signal Desktop 8.21.

### Added
- Nahrávání skupinových hovorů → MP3 (Record / Pause / Stop)
- Sumarizace chatu (1h / 8h / 24h, „Summarize from here“) s filtrem podle `sent_at`
- AI shrnutí: OpenAI, Gemini, Anthropic Claude, Perplexity (vlastní API klíče, safeStorage)
- Whisper přepis hovorů (lokální model, nastavitelné parametry)
- Záložky zpráv, export sumářů do chatu (toast)
- Příručka v aplikaci (`prirucka.md`), uvítací obrazovka
- GitHub Actions: release instalátoru, merge upstream Signálu
- Oddělený userData profil `%APPDATA%\Minutes`

### Changed
- Branding Minutes (ikony, menu, startup splash)
- Architektura: veškerá logika v `ts/minutes/`, tenké hooky v upstream

### Known limitations
- Pouze Windows instalátor (NSIS), bez code signing
- Auto-update vypnuto — nová verze ručně z GitHub Releases
