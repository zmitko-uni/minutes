# Fork maintainability — základní pravidlo minutes

> **Tento projekt je fork Signal Desktop. Všechno musíme dělat tak, aby šel fork pravidelně aktualizovat o nové verze Signálu bez konfliktů. Toto je klíčové.**

## Proč

Signal Desktop se mění často — protokol, RingRTC, Redux, build. Každá úprava uvnitř upstream souborů je budoucí merge konflikt. Cíl minutes není přepsat Signál, ale **přidat tenkou vrstvu** vedle něj.

## Zlaté pravidlo

| ✅ Dělej | ❌ Nedělej |
|---------|-----------|
| Nový kód do `ts/minutes/` | Velké refactory v `ts/services/`, `ts/state/`, `app/` |
| Jeden nový soubor `app/minutes_*.main.ts` pro IPC | Rozšiřovat `app/main.main.ts` o stovky řádků |
| V upstream souboru jen **hook** (import + 1 volání) | Kopírovat celé upstream funkce a upravovat |
| Registrovat menu/IPC přes vlastní modul | Měnit chování existujících Signal menu položek |
| Dokumentovat každý dotčený upstream soubor v `docs/MINUTES-PATCHES.md` | „Rychlé“ úpravy bez záznamu |
| Před merge: `pnpm run merge-upstream` + kontrola patch listu | Měsíce práce bez syncu s upstream |

## Architektura vrstvy

```
┌─────────────────────────────────────────┐
│  Signal Desktop (upstream)              │
│  — mění se při každém merge             │
└──────────────┬──────────────────────────┘
               │ tenké hooky (min. řádků)
               ▼
┌─────────────────────────────────────────┐
│  ts/minutes/                          │
│  — veškerá logika minutes             │
│  — vlastní testy, vlastní typy           │
└──────────────┬──────────────────────────┘
               │ IPC
               ▼
┌─────────────────────────────────────────┐
│  app/minutes_channel.main.ts          │
│  — main process (soubory, loopback)    │
└─────────────────────────────────────────┘
```

## Jak psát hook v upstream souboru

**Správně** — import + jedno volání, žádná business logika:

```typescript
import { callRecordingService } from '../minutes/index.preload.ts';

// ... uvnitř existujícího handleru:
drop(callRecordingService.onGroupCallJoined({ conversationId, callMode, eraId }));
```

**Špatně** — desítky řádků nahrávání přímo v `calling.preload.ts`.

## Kde smí být změny upstream

Povolené dotyky (udržovat seznam v `docs/MINUTES-PATCHES.md` aktuální):

1. **Registrace** — `background.preload.ts`, `main.main.ts` (jen `initialize…()`)
2. **Lifecycle hook** — `calling.preload.ts` (join/end group call)
3. **Branding / data dir** — `package.json`, `user_config.main.ts`
4. **Menu** — `menu.std.ts`, `ts/types/menu.std.ts` (pouze nová položka minutes)

Nový upstream soubor do seznamu přidáváš **jen když neexistuje čistší cesta** (IPC, event, vlastní modul).

## Postup při nové feature

1. Navrhni řešení **nejdřív v `ts/minutes/`**
2. Potřebuješ hook? — přidej nejmenší možný řádek do upstream
3. Aktualizuj `docs/MINUTES-PATCHES.md`
4. Po implementaci spusť upstream sync přes GitHub Actions (ne lokální `git pull` ze Signálu)

## Merge workflow

**Signal upstream není git remote v tomto repozitáři.**  
Oficiální [Signal Desktop](https://github.com/signalapp/Signal-Desktop) držíme mimo tento clone (např. vedle v `../Signal-Desktop/`). Sloučení upstreamu probíhá **v GitHub Actions**:

1. Repo → **Actions** → **Merge Signal upstream**
2. Zvol ref (např. `main` nebo tag `v8.21.0-alpha.1`) — nebo nech běžet **týdenní cron** (pondělí 08:00 UTC), který porovná nejnovější **stabilní** tag Signálu s `MINUTES_SIGNAL_BASE_VERSION` a při novější verzi sám otevře sync PR
3. Volitelně zaškrtni **dry_run** — jen vypíše, jestli je novější stabilní tag (bez merge / PR)
4. Bez dry_run workflow vytvoří větev `sync/signal-<run>` a **pull request** do `main` (u cronu jen pokud je nový stabilní tag a ještě neexistuje otevřený sync PR)
5. Po review PR merge — zkontroluj hooky v `docs/MINUTES-PATCHES.md` a bump `MINUTES_SIGNAL_BASE_VERSION` v `ts/minutes/version.std.ts`

Lokální kontrola „je nový stabilní Signál?“ (bez merge):

```powershell
node scripts/check-signal-upstream.mjs
```

Lokálně **nepoužívej** `git pull origin` ze Signálu. Jediný remote:

```powershell
git remote -v
# origin  https://github.com/zmitko-uni/minutes.git (fetch)
# origin  https://github.com/zmitko-uni/minutes.git (push)
```

Pro lokální test merge skriptu (stejná logika jako CI, bez persistentního upstream remote):

```powershell
node scripts/merge-upstream.mjs main
# nebo konkrétní tag:
node scripts/merge-upstream.mjs v8.21.0-alpha.1
```

Skript automaticky řeší pouze známé konflikty v `package.json`,
`pnpm-lock.yaml` a `ts/components/ChatsTab.dom.tsx`. Pro `package.json` používá
sémantický třícestný merge, lockfile nechá znovu vygenerovat a uvítací obrazovku
zachová jen tehdy, pokud stále obsahuje `MinutesWelcomeSplash`. Jakýkoli jiný
konflikt nebo neznámá kolize hodnot běh bezpečně zastaví k ručnímu review.

Po merge konflikty řeš takto:

1. Upstream verze má přednost v Signal logice
2. Na konec souboru / vedle hooku znovu přidej minutes řádky
3. Nikdy nemaž upstream změny kvůli minutes

## Past při merge upstreamu: konfigurace a updater

Minutes za běhu spoléhá na `NODE_CONFIG_ENV=minutes` (`config/minutes.json`: `updatesEnabled: false`, `storageProfile`). Upstream v `app/config.main.ts` pro balíčkovanou aplikaci `NODE_CONFIG_ENV` maže; proto tam po hardeningu voláme `applyMinutesConfigEnv()`. Když se tohle volání při merge ztratí, balíček použije `production.json`: zapne Signal updater (stáhne a nainstaluje oficiální Signal) a otevře nový datový adresář `Minutes Beta` místo `Minutes-Beta`. Hlídá to test `ts/test-node/minutes/configEnv_test.std.ts`; po každém merge Signalu ho spusťte a po buildu zkontrolujte v logu `updater/start: Updates disabled`.

## Minutes RingRTC (fork minutes-ringrtc)

Minutes **nepoužívá** stock `@signalapp/ringrtc`, ale fork [`zmitko-uni/minutes-ringrtc`](https://github.com/zmitko-uni/minutes-ringrtc) — jsou v něm nahrávací tapy (audio post-APM a odchozí video). Aktuálně **`2.74.0-minutes.1`** (Signal RingRTC 2.74.0, WebRTC `8037b`, sedí k Signal Desktop 8.36). Tento repo RingRTC nesestavuje — jen stahuje ověřený tarball z GitHub Release forku.

Nové Signal Desktop obvykle chce i novější RingRTC (např. 8.36 → 2.74: `AudioDeviceList`, `setAudioInputById`, `GroupCallSvcConfig`). Proto se RingRTC bumpuje **spolu** s mergem Signalu.

**Postup při dalším upgradu RingRTC:**

1. V **minutes-ringrtc** zmergovat upstream tag (`minutes_merge_upstream.yml` nebo ručně), přebasovat WebRTC patch (`patches/webrtc/`) a ověřit buildem (`minutes_desktop_artifacts.yml`: PR → Windows + macOS + Linux).
2. Vydat prebuild (`minutes_release.yml` nebo `bin/minutes_version.py prepare-release` + tag `v<verze>-minutes.N`).
3. V tomto repu bumpnout tarball v `package.json` a `MINUTES_RINGRTC_PACKAGE_VERSION` (`scripts/utils/minutesRingRtcInstall.mjs`) + test, přegenerovat `pnpm-lock.yaml`.
4. Ověřit hovor + nahrávku zvuku i videa na Windows i macOS, pak beta/prod.
## Kontrolní seznam před PR / commitem

- [ ] Většina diffu je v `ts/minutes/` nebo `app/minutes_*.ts`
- [ ] Upstream změny jsou jen hooky / registrace
- [ ] `docs/MINUTES-PATCHES.md` je aktuální
- [ ] `CHANGELOG.md` — `[Unreleased]` doplněno u user-facing změn
- [ ] `pnpm run check:types` (nebo Minutes CI na GitHubu)
- [ ] Žádné formátování / rename v Signal souborech „pro čistotu“
- [ ] Feature funguje bez nutnosti kopírovat upstream třídy

## Release checklist (maintainer)

1. `[Unreleased]` v `CHANGELOG.md` je aktuální
2. Actions → **Release Minutes** → Run workflow (nebo lokálně `release:minutes:metadata` + push `chore(release):`)
3. Ověřte GitHub Release a stažení `Minutes-setup-windows-x64.exe`

## Co dělat, když to nejde bez většího zásahu

1. Zastav se a zvaž **alternativu** (IPC, sidecar proces, externí nástroj)
2. Pokud musíš — izoluj do samostatného souboru a jediného importu
3. Zdokumentuj **proč** a plán na budoucí refaktor zpět do `ts/minutes/`

---

*Toto pravidlo má přednost před pohodlím implementace. Fork, který nejde aktualizovat, je mrtvý fork.*
