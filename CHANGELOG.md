# Changelog

Všechny významné změny v **Minutes** (fork Signal Desktop) jsou zdokumentovány zde.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verze produktu odpovídají `package.json` a GitHub Releases ve tvaru **`{Signal}-m{Meetup}`**
(např. `8.21.0-m1.0.1` — Signal Desktop base + Meetup semver za `-m`).
Po merge upstream Signal aktualizuj `MINUTES_SIGNAL_BASE_VERSION` v `ts/minutes/version.std.ts`.

Před release doplňte sekci **[Unreleased]** (Added / Changed / Fixed). Agent / vývojář spustí
`pnpm run release:minutes:metadata`, commitne `package.json` + `CHANGELOG.md` a pushne na `main`.
GitHub Actions pak automaticky sestaví instalátor a vytvoří Release s patch notes z verzované sekce CHANGELOG.

## [Unreleased]

### Added
- (doplňte před příštím release)

## [8.21.0-m1.0.4] - 2026-07-11

### Changed
- Release 8.21.0-m1.0.4 (viz git historie od v8.21.0-m1.0.3).

## [8.21.0-m1.0.3] - 2026-07-11

### Changed
- Show app update UI only in home footer, remove top banner.

## [8.21.0-m1.0.2] - 2026-07-10

### Changed
- Aktualizace: stav jen ve footeru domovské obrazovky (bez horní modré/zelené lišty); po kontrole tlačítko Stáhnout, ne auto-download
- Verze produktu: formát `8.21.0-m1.0.1` (Signal base + `-m` + Meetup semver); UI zobrazuje celý tag
- Migrace z alpha buildů a starého Meetup semver (`1.0.x`): nový formát se správně detekuje jako novější

### Fixed
- CI build: `parseVersion` rozpozná verzi `8.21.0-m1.0.1` (skript `get-expire-time`)

## [1.0.1] - 2026-07-10

### Changed
- Ctrl+Shift+M otevře Přepisy (Minutes) místo Signálu „Všechna média“; zkratka pro log odstraněna
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
