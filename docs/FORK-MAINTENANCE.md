# Fork maintainability — základní pravidlo uuMinutes

> **Tento projekt je fork Signal Desktop. Všechno musíme dělat tak, aby šel fork pravidelně aktualizovat o nové verze Signálu bez konfliktů. Toto je klíčové.**

## Proč

Signal Desktop se mění často — protokol, RingRTC, Redux, build. Každá úprava uvnitř upstream souborů je budoucí merge konflikt. Cíl uuMinutes není přepsat Signál, ale **přidat tenkou vrstvu** vedle něj.

## Zlaté pravidlo

| ✅ Dělej | ❌ Nedělej |
|---------|-----------|
| Nový kód do `ts/uuminutes/` | Velké refactory v `ts/services/`, `ts/state/`, `app/` |
| Jeden nový soubor `app/uuminutes_*.main.ts` pro IPC | Rozšiřovat `app/main.main.ts` o stovky řádků |
| V upstream souboru jen **hook** (import + 1 volání) | Kopírovat celé upstream funkce a upravovat |
| Registrovat menu/IPC přes vlastní modul | Měnit chování existujících Signal menu položek |
| Dokumentovat každý dotčený upstream soubor v `docs/UUMINUTES-PATCHES.md` | „Rychlé“ úpravy bez záznamu |
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
│  ts/uuminutes/                          │
│  — veškerá logika uuMinutes             │
│  — vlastní testy, vlastní typy           │
└──────────────┬──────────────────────────┘
               │ IPC
               ▼
┌─────────────────────────────────────────┐
│  app/uuminutes_channel.main.ts          │
│  — main process (soubory, loopback)    │
└─────────────────────────────────────────┘
```

## Jak psát hook v upstream souboru

**Správně** — import + jedno volání, žádná business logika:

```typescript
import { callRecordingService } from '../uuminutes/index.preload.ts';

// ... uvnitř existujícího handleru:
drop(callRecordingService.onGroupCallJoined({ conversationId, callMode, eraId }));
```

**Špatně** — desítky řádků nahrávání přímo v `calling.preload.ts`.

## Kde smí být změny upstream

Povolené dotyky (udržovat seznam v `docs/UUMINUTES-PATCHES.md` aktuální):

1. **Registrace** — `background.preload.ts`, `main.main.ts` (jen `initialize…()`)
2. **Lifecycle hook** — `calling.preload.ts` (join/end group call)
3. **Branding / data dir** — `package.json`, `user_config.main.ts`
4. **Menu** — `menu.std.ts`, `ts/types/menu.std.ts` (pouze nová položka uuMinutes)

Nový upstream soubor do seznamu přidáváš **jen když neexistuje čistší cesta** (IPC, event, vlastní modul).

## Postup při nové feature

1. Navrhni řešení **nejdřív v `ts/uuminutes/`**
2. Potřebuješ hook? — přidej nejmenší možný řádek do upstream
3. Aktualizuj `docs/UUMINUTES-PATCHES.md`
4. Po implementaci spusť upstream sync přes GitHub Actions (ne lokální `git pull` ze Signálu)

## Merge workflow

**Signal upstream není git remote v tomto repozitáři.**  
Oficiální [Signal Desktop](https://github.com/signalapp/Signal-Desktop) držíme mimo tento clone (např. vedle v `../Signal-Desktop/`). Sloučení upstreamu probíhá **v GitHub Actions**:

1. Repo → **Actions** → **Merge Signal upstream**
2. Zvol ref (např. `main` nebo tag `v8.21.0-alpha.1`)
3. Workflow vytvoří větev `sync/signal-<run>` a **pull request** do `main`
4. Po review PR merge — zkontroluj hooky v `docs/UUMINUTES-PATCHES.md`

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

Po merge konflikty řeš takto:

1. Upstream verze má přednost v Signal logice
2. Na konec souboru / vedle hooku znovu přidej uuMinutes řádky
3. Nikdy nemaž upstream změny kvůli uuMinutes

## Kontrolní seznam před PR / commitem

- [ ] Většina diffu je v `ts/uuminutes/` nebo `app/uuminutes_*.ts`
- [ ] Upstream změny jsou jen hooky / registrace
- [ ] `docs/UUMINUTES-PATCHES.md` je aktuální
- [ ] Žádné formátování / rename v Signal souborech „pro čistotu“
- [ ] Feature funguje bez nutnosti kopírovat upstream třídy

## Co dělat, když to nejde bez většího zásahu

1. Zastav se a zvaž **alternativu** (IPC, sidecar proces, externí nástroj)
2. Pokud musíš — izoluj do samostatného souboru a jediného importu
3. Zdokumentuj **proč** a plán na budoucí refaktor zpět do `ts/uuminutes/`

---

*Toto pravidlo má přednost před pohodlím implementace. Fork, který nejde aktualizovat, je mrtvý fork.*
