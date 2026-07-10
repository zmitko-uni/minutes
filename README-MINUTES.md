# minutes

Fork of [Signal Desktop](https://github.com/signalapp/Signal-Desktop) focused on **meeting minutes** — call recording, chat summaries, Whisper transcription, and AI assistance.

## Klíčové pravidlo (přečti jako první)

> **Tím, že je tento projekt fork Signálu, vše děláme tak, aby šel fork pravidelně aktualizovat o nové verze Signal Desktop bez merge konfliktů.**

- Veškerá logika → `ts/minutes/`
- Upstream Signal soubory → jen tenké hooky (import + jedno volání)
- Každý dotyk upstream → `docs/MINUTES-PATCHES.md`
- Podrobně: **[docs/FORK-MAINTENANCE.md](docs/FORK-MAINTENANCE.md)**

Signal UX and login are unchanged. Minutes extensions live in `ts/minutes/` with minimal hooks in upstream files.

## Features

| Feature | Status |
|---------|--------|
| Signal UI + login (production servers) | ✅ |
| **Skupinový hovor** — Record / Pause / Resume / Stop → MP3 | ✅ |
| **Sumarizace chatu** — 1h / 8h / 24h, „Summarize from here“ (filtr podle `sent_at`) | ✅ |
| **Whisper přepis hovoru** — lokální model, VAD, prompt chaining, AI korekce | ✅ |
| **AI shrnutí** — OpenAI, Gemini, Anthropic Claude, Perplexity (vlastní API klíče) | ✅ |
| **Sumarizace hovoru** — rozšíření přepisu (menu Minutes) | ✅ |
| Záložky zpráv | ✅ |
| Odeslání sumáře do chatu (toast) | ✅ |
| Příručka v aplikaci + uvítací obrazovka | ✅ |
| GitHub Actions — CI, release, upstream merge | ✅ |

Detailní popis: **[images/minutes/prirucka.md](images/minutes/prirucka.md)**  
Změny verzí: **[CHANGELOG.md](CHANGELOG.md)**

## Prerequisites (Windows)

1. **Node.js** — see `.nvmrc` (use nvm-windows or install matching version)
2. **pnpm** — `npm install -g pnpm`
3. **Python 3**
4. **Visual Studio 2022** — workload *Desktop development with C++*
5. Build from **x64 Native Tools Command Prompt** or short path (avoid Windows MAX_PATH issues)

## First-time build

```powershell
cd c:\WORK\_TECH\AI_tools\minutes
pnpm install
pnpm run generate
pnpm run start:minutes
```

`start:minutes` uses production Signal servers (`config/minutes.json`) and separate user data at `%APPDATA%\Minutes`.

## Development workflow

```powershell
# Terminal 1 — watch TypeScript bundles
pnpm run dev:transpile

# Terminal 2 — run app
pnpm run start:minutes
```

## CI

**GitHub Actions → Minutes CI** běží na push/PR do `main`: `pnpm install` → `generate` → `check:types`.

Lokálně před commitem:

```powershell
pnpm run check:types
```

## Windows installer (pro někoho jiného)

Pro vytvoření **NSIS instalátoru** (`.exe`), který můžete poslat kolegovi:

```powershell
pnpm install
pnpm run build:minutes:installer
```

Výstup: `release/minutes/Minutes-setup-<verze>.exe`

### Release přes GitHub Actions (doporučeno)

1. Doplňte **`CHANGELOG.md`** — sekce `[Unreleased]` (workflow ji použije v release notes)
2. **GitHub → Actions → Release Minutes → Run workflow**
3. Workflow automaticky:
   - spustí typecheck (fail-fast před buildem)
   - zvedne verzi v `package.json` (alpha.1 → alpha.2, …)
   - sestaví Windows instalátor
   - vytvoří **GitHub Release** s `.exe` a poznámkami z CHANGELOG
   - commitne bump verze do `main`
4. Stabilní odkaz:  
   `https://github.com/zmitko-uni/minutes/releases/latest/download/Minutes-setup-windows-x64.exe`

Volba *Skip version bump* — přestaví stejnou verzi (např. po opravě buildu).

### Lokální build (vývoj)

| Co | Detail |
|----|--------|
| První build | 15–30 min (locales, emoji, native moduly) |
| Požadavky | stejné jako vývoj — Node, pnpm, VS C++ workload |
| Podpis | **bez** code signing — SmartScreen může varovat → *Více informací* → *Přesto spustit* |
| Data uživatele | `%APPDATA%\Minutes` — při odinstalaci se **nemazou** |
| Aktualizace | vypnuté (`updatesEnabled: false`) — stáhněte nový `.exe` z [Releases](https://github.com/zmitko-uni/minutes/releases/latest) a nainstalujte přes existující instalaci |

Instalátor je vhodný pro interní/ad-hoc distribuci. Pro veřejné šíření by bylo potřeba Windows code signing certifikát.

## Output locations

| Type | Path |
|------|------|
| Call recordings (MP3 + JSON metadata) | `%APPDATA%\Minutes\minutes\recordings\` |
| Chat summaries (MD + JSON metadata) | `%APPDATA%\Minutes\minutes\summaries\` |
| AI settings (encrypted API key) | `%APPDATA%\Minutes\minutes\ai-settings.json` |
| Whisper models | `%APPDATA%\Minutes\minutes\whisper-models\` |

Menu: **Minutes → Open Call Recordings / Open Chat Summaries / AI Settings… / Příručka…**

Uživatelská příručka (součást aplikace): `images/minutes/prirucka.md` — udržujte synchronní s novými funkcemi.

## Call recording behavior

- **Group calls** — tlačítka v liště hovoru (vedle mute):
  - **Record** — spustí nahrávání (loopback + mikrofon)
  - **Pause / Resume** — pozastaví / obnoví bez ukončení
  - **Stop** — uloží MP3 + JSON metadata
- Při ukončení hovoru se aktivní nahrávka automaticky uloží
- Používá Signal lame MP3 encoder worklet

> Recording laws vary by jurisdiction — ensure participants consent.

## Chat summary

- **Zpráva** — pravý klik → Minutes → Summarize from here
- **Chat menu** (⋯) → Minutes → Summarize last 1h / 8h / 24h
- **Levý panel** — pravý klik na konverzaci → stejné položky + Open recordings / summaries
- **Menu** → Minutes → Summarize Current Chat (`Ctrl+Shift+U`)
- Export do `%APPDATA%\Minutes\minutes\summaries\` (markdown + JSON)
- Volitelné **AI Summary** po exportu (viz Nastavení AI)

## AI & Whisper

1. **Menu → Minutes → Nastavení AI…** — API klíče (OpenAI, Gemini, Claude, Perplexity), model, jazyk; klíč šifrovaně přes OS safeStorage
2. **Menu → Minutes → Sumarizace hovoru…** — Whisper přepis, rozšíření přepisu, volitelná AI korekce
3. Data chatu/hovoru zůstávají lokálně; do cloudu jdou jen volání zvoleného AI poskytovatele (pokud je zapnuto)

## Architecture

```
ts/minutes/
  callRecorder.dom.ts              # MP3 capture
  callRecordingService.preload.ts  # lifecycle (onCallEnded)
  chatSummaryService.preload.ts    # chat export + AI
  whisperTranscribe.main.ts        # lokální Whisper
  aiSettings*.ts / *Summary.main.ts
  components/                      # UI modaly, recording controls
  index.preload.ts                 # bootstrap

app/minutes_channel.main.ts      # IPC: save files, loopback

Hooks (keep small for upstream merges):
  ts/services/calling.preload.ts   # onCallEnded
  ts/background.preload.ts         # init + menu IPC
  app/main.main.ts                 # menu + IPC channel
  app/menu.std.ts                  # Minutes menu
```

## Sync with upstream Signal

Toto repo sleduje jen **[github.com/zmitko-uni/minutes](https://github.com/zmitko-uni/minutes)**.  
Upstream [signalapp/Signal-Desktop](https://github.com/signalapp/Signal-Desktop) se mergeuje **v GitHub Actions** (Actions → *Merge Signal upstream* → PR do `main`).

Podrobně: [docs/FORK-MAINTENANCE.md](docs/FORK-MAINTENANCE.md)

## Contributing

Viz **[CONTRIBUTING-MINUTES.md](CONTRIBUTING-MINUTES.md)**.

## License

AGPL-3.0-only (inherited from Signal Desktop). Minutes modifications are under the same license.
