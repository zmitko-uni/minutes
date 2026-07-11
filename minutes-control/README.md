# minutes-control

Lokální helper skripty pro vývoj a release **Minutes** (mimo `pnpm` / GitHub Actions).

Spouštěj z kořene repozitáře nebo přímo z této složky — každý `.bat` si sám přepne do repo rootu.

## Windows (`.bat`)

| Skript | Účel |
|--------|------|
| `setup-minutes.bat` | `pnpm install` + `pnpm run generate` |
| `start-minutes.bat` | Build + spuštění prod Minutes |
| `start-minutes-quick.bat` | Spuštění bez rebuildu |
| `start-minutes-beta.bat` | Spuštění Minutes Beta (`%APPDATA%\Minutes-Beta`) |
| `prepare-minutes-release.bat` | Před-release kontroly (install, ikony, generate, types) |
| `build-minutes-release.bat` | Sestavení NSIS instalátoru (vyžaduje VS C++) |
| `minutes-quality-gate.bat` | Stejné kontroly jako CI před pushem |
| `test-call-pipeline.bat` | Test Whisper → AI korekce → sumarizace na nahrávce |

Beta instalátor lokálně: `set MINUTES_RELEASE_CHANNEL=beta` a pak `build-minutes-release.bat`.

## macOS

Skripty pro Mac budou ve složce [`mac/`](./mac/).
