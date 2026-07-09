# uuMinutes

Fork of [Signal Desktop](https://github.com/signalapp/Signal-Desktop) focused on **group conversations** — automatic call recording (MP3) and chat summaries.

## Klíčové pravidlo (přečti jako první)

> **Tím, že je tento projekt fork Signálu, vše děláme tak, aby šel fork pravidelně aktualizovat o nové verze Signal Desktop bez merge konfliktů.**

- Veškerá logika → `ts/uuminutes/`
- Upstream Signal soubory → jen tenké hooky (import + jedno volání)
- Každý dotyk upstream → `docs/UUMINUTES-PATCHES.md`
- Podrobně: **[docs/FORK-MAINTENANCE.md](docs/FORK-MAINTENANCE.md)**

Signal UX and login are unchanged. uuMinutes extensions live in `ts/uuminutes/` with minimal hooks in upstream files.

## Features (v0.2)

| Feature | Status |
|---------|--------|
| Signal UI + login (production servers) | ✅ |
| **Group call** — tlačítko Record / Pause / Resume / Stop → MP3 | ✅ |
| **Zpráva** — context menu „Summarize from here“ | ✅ |
| **Chat menu** — Summarize last 1h / 8h / 24h | ✅ |
| Rychlý přístup k nahrávkám a sumářům (chat menu + levý panel) | ✅ |
| **AI summary** (OpenAI / ChatGPT, vlastní API klíč) | ✅ |
| Whisper transcription | 🔜 |
| Post summary back to chat | ✅ (toast po uložení) |

## Prerequisites (Windows)

1. **Node.js** — see `.nvmrc` (use nvm-windows or install matching version)
2. **pnpm** — `npm install -g pnpm`
3. **Python 3**
4. **Visual Studio 2022** — workload *Desktop development with C++*
5. Build from **x64 Native Tools Command Prompt** or short path (avoid Windows MAX_PATH issues)

## First-time build

```powershell
cd c:\WORK\_TECH\AI_tools\uuMinutes
pnpm install
pnpm run generate
pnpm run start:uuminutes
```

`start:uuminutes` uses production Signal servers (`config/uuminutes.json`) and separate user data at `%APPDATA%\uuMinutes-uuminutes`.

## Development workflow

```powershell
# Terminal 1 — watch TypeScript bundles
pnpm run dev:transpile

# Terminal 2 — run app
pnpm run start:uuminutes
```

## Windows installer (pro někoho jiného)

Pro vytvoření **NSIS instalátoru** (`.exe`), který můžete poslat kolegovi:

```powershell
pnpm install
pnpm run build:uuminutes:installer
```

Výstup: `release/uuminutes/uuMinutes-setup-<verze>.exe`

| Co | Detail |
|----|--------|
| První build | 15–30 min (locales, emoji, native moduly) |
| Požadavky | stejné jako vývoj — Node, pnpm, VS C++ workload |
| Podpis | **bez** code signing — SmartScreen může varovat → *Více informací* → *Přesto spustit* |
| Data uživatele | `%APPDATA%\uuMinutes-uuminutes` — při odinstalaci se **nemazou** |
| Aktualizace | vypnuté (`updatesEnabled: false`) — novou verzi je potřeba poslat znovu |

Instalátor je vhodný pro interní/ad-hoc distribuci. Pro veřejné šíření by bylo potřeba Windows code signing certifikát.

## Output locations

| Type | Path |
|------|------|
| Call recordings (MP3 + JSON metadata) | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\recordings\` |
| Chat summaries (MD + JSON metadata) | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\summaries\` |

| AI settings (encrypted API key) | `%APPDATA%\uuMinutes-uuminutes\uuMinutes\ai-settings.json` |

Menu: **uuMinutes → Open Call Recordings / Open Chat Summaries / AI Settings… / Příručka…**

Uživatelská příručka (součást aplikace): `images/uuminutes/prirucka.md` — popis funkcí a ovládání. Udržujte ji synchronní s novými funkcemi.

## Call recording behavior

- **Group calls only** — tlačítka v liště hovoru (vedle mute):
  - **Record** — spustí nahrávání (loopback + mikrofon)
  - **Pause / Resume** — pozastaví / obnoví bez ukončení
  - **Stop** — uloží MP3 + JSON metadata
- Při ukončení hovoru se aktivní nahrávka automaticky uloží
- Používá Signal lame MP3 encoder worklet

> Recording laws vary by jurisdiction — ensure participants consent.

## Chat summary

- **Zpráva** — pravý klik → „uuMinutes: Summarize from here“
- **Chat menu** (⋯ v hlavičce) → uuMinutes → Summarize last 1h / 8h / 24h
- **Levý panel** — pravý klik na konverzaci → stejné položky + Open recordings / summaries
- **Menu** → uuMinutes → Summarize Current Chat (`Ctrl+Shift+U`)
- Export do `%APPDATA%\uuMinutes-uuminutes\uuMinutes\summaries\` (markdown + JSON)
- Pokud je zapnuté **AI Settings** (OpenAI API klíč), soubor obsahuje sekci **AI Summary** (doporučený model `gpt-4o-mini`)

### AI summary (OpenAI)

1. **Menu → uuMinutes → AI Settings…**
2. Vložte API klíč z [platform.openai.com](https://platform.openai.com/api-keys) (účtování na vašem OpenAI účtu)
3. Zapněte „Enable AI summary after export“, zvolte model a jazyk (výchozí `cs`)
4. **Test connection** ověří klíč; **Save** uloží nastavení (klíč šifrovaně přes OS safeStorage)
5. Při každém summarize se po exportu zpráv zavolá ChatGPT API a výsledek se přidá do `.md`

## Architecture

```
ts/uuminutes/
  callRecorder.dom.ts       # MP3 capture (reuses mp3Encoder worklet)
  callRecordingService.preload.ts  # group call lifecycle
  chatSummaryService.preload.ts    # chat export + volitelné AI summary
  aiSettings*.ts / openaiSummary.main.ts
  components/UuMinutesSettingsModal.dom.tsx
  index.preload.ts          # bootstrap

app/uuminutes_channel.main.ts      # IPC: save files, loopback source

Hooks (keep small for upstream merges):
  ts/services/calling.preload.ts   # onGroupCallJoined / onEnded
  ts/background.preload.ts         # init + menu IPC
  app/main.main.ts                 # menu + IPC channel
  app/menu.std.ts                  # uuMinutes menu
```

## Sync with upstream Signal

```powershell
pnpm run merge-upstream
# or specific branch/tag:
node scripts/merge-upstream.mjs v8.20.0
```

Resolve conflicts preferring upstream, then re-apply uuMinutes hooks if needed.

## License

AGPL-3.0-only (inherited from Signal Desktop). uuMinutes modifications are under the same license.
