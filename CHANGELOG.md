# Changelog

Všechny významné změny v **Minutes** (fork Signal Desktop) jsou zdokumentovány zde.

Formát vychází z [Keep a Changelog](https://keepachangelog.com/cs/1.1.0/).
Verze odpovídají `package.json` a GitHub Releases.

Před release doplňte sekci **[Unreleased]**; workflow *Release Minutes* ji použije v popisu release
(pokud existuje odpovídající verze, bere tu).

## [Unreleased]

### Added
- (doplňte před příštím release)

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
