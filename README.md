# Minutes

[![Latest release](https://img.shields.io/github/v/release/zmitko-uni/minutes?label=Latest%20release&sort=semver)](https://github.com/zmitko-uni/minutes/releases/latest)
[![Windows installer](https://img.shields.io/badge/Download-Windows%20x64-blue)](https://github.com/zmitko-uni/minutes/releases/latest/download/Minutes-setup-windows-x64.exe)

Fork [Signal Desktop](https://github.com/signalapp/Signal-Desktop) pro **nahrávání hovorů**, **sumarizaci chatů** a **AI asistenci** u schůzek.

## Stažení (Windows)

| | |
|---|---|
| **Nejnovější release** | [github.com/zmitko-uni/minutes/releases/latest](https://github.com/zmitko-uni/minutes/releases/latest) |
| **Přímý link instalátoru** | [Minutes-setup-windows-x64.exe](https://github.com/zmitko-uni/minutes/releases/latest/download/Minutes-setup-windows-x64.exe) |

> Instalátor není code-signed — SmartScreen může varovat → *Více informací* → *Přesto spustit*.

## Funkce

- Nahrávání hovorů (1:1 i skupina) → MP3 + přepis (Whisper)
- Sumarizace chatu (1h / 8h / 24h, od zprávy)
- AI shrnutí (OpenAI, Gemini, Claude, Perplexity — vlastní API klíč)
- Záložky zpráv, příručka v aplikaci

## Vývoj

Podrobná dokumentace: **[README-UUMINUTES.md](README-UUMINUTES.md)**

```powershell
pnpm install
pnpm run generate
pnpm run start:uuminutes
```

## Release

Nový instalátor vytvoříš v **Actions → Release Minutes** (workflow_dispatch).  
Výsledek: GitHub Release s `.exe` — automaticky se zobrazí na homepage repozitáře v sekci **Latest release**.

## Upstream Signal

Aktualizace ze Signálu: **Actions → Merge Signal upstream** → review PR → merge.

## Licence

AGPL-3.0-only (děděno ze Signal Desktop). Minutes rozšíření: `ts/uuminutes/`.
