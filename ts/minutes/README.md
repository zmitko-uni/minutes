# ts/minutes/

**Veškerá minutes logika patří sem.** Tento adresář je izolovaná vrstva nad Signal Desktop.

## Proč

Projekt je fork Signálu — musí jít aktualizovat o nové upstream verze bez konfliktů. Kód mimo tento adresář (a registrované hooky) ztěžuje merge.

## Pravidla

- Nové feature implementuj **zde**, ne v `ts/services/`, `ts/state/`, `ts/components/`
- Upstream se dotýkáš jen přes hook v `docs/MINUTES-PATCHES.md`
- Main-process věci → `app/minutes_channel.main.ts`, ne rozšiřovat `main.main.ts`

Viz `docs/FORK-MAINTENANCE.md`.
