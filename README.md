# Minutes

[![Latest release](https://img.shields.io/github/v/release/zmitko-uni/minutes?label=Latest%20release&sort=semver)](https://github.com/zmitko-uni/minutes/releases/latest)
[![Windows installer](https://img.shields.io/badge/Download-Windows%20x64-blue)](https://github.com/zmitko-uni/minutes/releases/latest/download/Minutes-setup-windows-x64.exe)

Fork [Signal Desktop](https://github.com/signalapp/Signal-Desktop) pro **nahrávání hovorů**, **sumarizaci chatů** a **AI asistenci** u schůzek a konverzací.

Signal zůstává komunikační klient; Minutes přidává nástroje pro zápisy, přepisy a shrnutí.

---

## Stažení (Windows)

| | |
|---|---|
| **Nejnovější release** | [Releases → Latest](https://github.com/zmitko-uni/minutes/releases/latest) |
| **Přímý link instalátoru** | [Minutes-setup-windows-x64.exe](https://github.com/zmitko-uni/minutes/releases/latest/download/Minutes-setup-windows-x64.exe) |

> Instalátor není code-signed — SmartScreen může varovat → *Více informací* → *Přesto spustit*.  
> Data uživatele: `%APPDATA%\uuMinutes-uuminutes` (při odinstalaci se nemazou).

---

## Dokumentace

| Dokument | Pro koho | Odkaz |
|----------|----------|--------|
| **Příručka Minutes** | uživatelé aplikace | [images/uuminutes/prirucka.md](images/uuminutes/prirucka.md) |
| **README-UUMINUTES** | vývojáři, build, architektura | [README-UUMINUTES.md](README-UUMINUTES.md) |
| **Changelog** | co je nového ve verzích | [CHANGELOG.md](CHANGELOG.md) |
| **Contributing** | PR, pravidla forku | [CONTRIBUTING-UUMINUTES.md](CONTRIBUTING-UUMINUTES.md) |
| **Údržba forku** | merge se Signálem | [docs/FORK-MAINTENANCE.md](docs/FORK-MAINTENANCE.md) |
| **Seznam patchů** | co jsme změnili v upstreamu | [docs/UUMINUTES-PATCHES.md](docs/UUMINUTES-PATCHES.md) |

V aplikaci: menu **Minutes → Příručka Minutes** (stejný obsah jako `prirucka.md`).

---

## Rychlý přehled funkcí

| Funkce | Kde v aplikaci |
|--------|----------------|
| Sumarizace chatu (1h / 8h / 24h) | Menu chatu ⋯, pravý klik na zprávu, `Ctrl+Shift+U` |
| Nahrávání hovoru → MP3 | Tlačítka Record / Pause / Stop v obrazovce hovoru |
| Přepis hovoru (Whisper) | Menu Minutes → Sumarizace hovoru… |
| AI shrnutí | Menu Minutes → Nastavení AI… (OpenAI, Gemini, Claude, Perplexity) |
| Záložky zpráv | Pravý klik → Minutes → Záložky… |
| Nahrávky a exporty | Menu Minutes → Otevřít nahrávky / sumarizace |

Výstupy na disku:

- Nahrávky: `%APPDATA%\uuMinutes-uuminutes\uuMinutes\recordings\`
- Sumarizace: `%APPDATA%\uuMinutes-uuminutes\uuMinutes\summaries\`

---

## Release Minutes (nová verze .exe)

1. Doplňte **`CHANGELOG.md`** — sekce `[Unreleased]` (workflow ji použije v popisu release)
2. **GitHub → Actions → [Release Minutes](https://github.com/zmitko-uni/minutes/actions/workflows/uuminutes-release.yml) → Run workflow**
3. Workflow: typecheck → bump verze → build → GitHub Release → commit verze
4. Po release přesuňte položky z `[Unreleased]` do nové sekce `## [x.y.z]` v CHANGELOG

Lokálně: `build-uuminutes-release.bat` (viz [README-UUMINUTES.md](README-UUMINUTES.md)).

**CI:** každý push/PR do `main` spouští [Minutes CI](https://github.com/zmitko-uni/minutes/actions/workflows/uuminutes-ci.yml) (`check:types`).

---

## Vývoj

**Požadavky:** Node.js (`.nvmrc`), pnpm, Python 3, VS 2022 s C++ workload.

```powershell
git clone https://github.com/zmitko-uni/minutes.git
cd minutes
pnpm install
pnpm run generate
pnpm run start:uuminutes
```

Nebo `setup-uuminutes.bat` → `start-uuminutes.bat` (Windows).

**Aktualizace ze Signálu:** Actions → [Merge Signal upstream](https://github.com/zmitko-uni/minutes/actions/workflows/uuminutes-merge-upstream.yml) → review PR → merge.

---

## Autor

**Ing. Martin Zmítko, Ph.D.** — na Signalu `@martinzmitko.01`

---

## O tomto repozitáři

Minutes je fork Signal Desktop (AGPL-3.0-only). Seznam **Contributors** na GitHubu zahrnuje autory celé historie Signálu — repozitář na ni navazuje kvůli pravidelným upstream merge.

Naše rozšíření jsou v `ts/uuminutes/` s minimálními hooky v upstream souborech.

## Licence

AGPL-3.0-only (děděno ze [Signal Desktop](https://github.com/signalapp/Signal-Desktop)).
