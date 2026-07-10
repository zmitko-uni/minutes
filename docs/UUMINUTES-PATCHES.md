# uuMinutes — doteky upstream Signal Desktop

> **Klíčové pravidlo:** viz [`FORK-MAINTENANCE.md`](./FORK-MAINTENANCE.md)

## Povolené modifikace upstream (aktuální stav)

| Soubor | Co | Hook |
|--------|-----|------|
| `package.json` | productName, skripty | branding |
| `app/user_config.main.ts` | `uuMinutes-*` userData | 1 řádek |
| `app/startup_config.main.ts` | uuMinutes AUMID + název aplikace | pár řádků |
| `app/WindowsNotifications.main.ts` | fallback toast + log AUMID | uuMinutes |
| `app/uuminutes_readme.main.ts` | načtení příručky z disku |
| `app/main.main.ts` | IPC init, menu akce, uuMinutes ikona, test pipeline hook (`UUMINUTES_TEST_PIPELINE=1`) | registrace |
| `app/SystemTrayService.main.ts` | tray ikona + tooltip uuMinutes | 2 volání |
| `app/menu.std.ts` | submenu uuMinutes + Příručka | menu |
| `ts/types/menu.std.ts` | typy menu akcí | menu |
| `ts/services/calling.preload.ts` | `onCallEnded` při konci hovoru | 2 volání |
| `ts/background.preload.ts` | init + IPC summarize, build expiration | bootstrap |
| `ts/components/CallScreen.dom.tsx` | `<UuMinutesCallRecordingControls />` | 1 komponenta |
| `ts/components/ChatsTab.dom.tsx` | uuMinutes uvítací obrazovka | 1 komponenta |
| `ts/components/App.dom.tsx` | uuMinutes host komponenty | +TranscriptionQueueHost |
| `ts/components/conversation/MessageContextMenu.dom.tsx` | `onBookmarkMessage` | 1 prop + item |
| `ts/components/conversation/TimelineMessage.dom.tsx` | callback pro záložky | 1 callback |
| `ts/uuminutes/bookmarks.std.ts` | typy záložek |
| `ts/uuminutes/bookmarks.main.ts` | persist JSON |
| `ts/uuminutes/bookmarksService.preload.ts` | add/list/navigate |
| `ts/uuminutes/components/UuMinutesBookmarksModal.dom.tsx` | dialog Záložky |
| `stylesheets/components/UuMinutesBookmarks.scss` | styly záložek |
| `ts/uuminutes/buildExpiration.preload.ts` | vypnutí expirace buildu |
| `ts/uuminutes/welcomeContent.std.ts` | texty uvítací obrazovky + dlaždice |
| `ts/uuminutes/components/UuMinutesWelcomeSplash.dom.tsx` | uvítání + 4 dlaždice |
| `ts/uuminutes/readmeService.preload.ts` | otevření modalu příručky |
| `ts/uuminutes/components/UuMinutesReadmeModal.dom.tsx` | modal příručky (Markdown) |
| `ts/uuminutes/components/UuMinutesMarkdown.dom.tsx` | render Markdown |
| `stylesheets/components/UuMinutesReadme.scss` | styly příručky |
| `stylesheets/components/UuMinutesStartupSplash.scss` | logo při startu aplikace |
| `images/uuminutes/prirucka.md` | uživatelská příručka (součást balíčku) |
| `background.html` | preload + title Minutes | startup logo |
| `loading.html` | preload ikony Minutes | migrace |

## Nové soubory (ne upstream)

| Cesta | Účel |
|-------|------|
| `ts/uuminutes/**` | business logika, UI komponenty |
| `app/uuminutes_channel.main.ts` | main-process IPC |
| `app/uuminutes_runtime.main.ts` | výchozí `NODE_CONFIG_ENV=uuminutes` pro balíček |
| `electron-builder.uuminutes.mjs` | NSIS profil (sloučení s package.json#build) |
| `scripts/build-uuminutes-installer.mjs` | build Windows instalátoru |
| `scripts/patch-electron-icon.mjs` | ikona electron.exe pro dev na Windows |
| `ts/uuminutes/aiSettings.std.ts` | typy + výchozí model |
| `ts/uuminutes/aiSettings.main.ts` | uložení klíče (safeStorage) |
| `ts/uuminutes/branding.std.ts` | zobrazovaný název Minutes (centrální branding) |
| `ts/uuminutes/aiSummaryService.main.ts` | směrování AI sumarizace podle poskytovatele |
| `ts/uuminutes/localLlmSettings.std.ts` | katalog GGUF modelů Gemma |
| `ts/uuminutes/localLlmExtension.*` | stažení + inference lokálního LLM |
| `ts/uuminutes/localLlmInference.main.ts` | node-llama-cpp chat session |
| `ts/uuminutes/components/UuMinutesLocalLlmPanel.dom.tsx` | panel instalace v Nastavení AI |
| `package.json` + `rolldown.config.ts` | závislost `node-llama-cpp` (native, external) |
| `ts/uuminutes/perplexitySummary.main.ts` | Perplexity API (bez web search) |
| `ts/uuminutes/anthropicSummary.main.ts` | Anthropic Claude API |
| `ts/uuminutes/aiSettingsService.preload.ts` | preload IPC wrapper |
| `ts/uuminutes/components/UuMinutesSettingsModal.dom.tsx` | dialog AI nastavení |
| `ts/uuminutes/appUpdate.*` | kontrola GitHub Releases, stažení, pending update |
| `ts/uuminutes/unreadSummaryService.preload.ts` | přehled nepřečtených chatů → Poznámky |
| `ts/uuminutes/components/UuMinutesAppUpdateBannerHost.dom.tsx` | banner aktualizace při startu |
| `ts/uuminutes/components/UuMinutesVersionFooter.dom.tsx` | patička verze na domovské obrazovce |
| `ts/uuminutes/components/UuMinutesSummaryToastHost.dom.tsx` | toast + odeslání do chatu |
| `stylesheets/components/UuMinutesSummaryToast.scss` | styly toastu |
| `stylesheets/manifest.scss` | import SCSS | 1 řádek |
| `ts/uuminutes/callSummaryExtension.std.ts` | typy rozšíření Sumarizace hovoru |
| `ts/uuminutes/callSummaryExtension.main.ts` | stažení modelu, přepis, uložení |
| `ts/uuminutes/whisperSettings.std.ts` | jazyk cs, prompt, výchozí Whisper model |
| `ts/uuminutes/audioPcm.dom.ts` | MP3 → PCM přes Web Audio (bez ffmpeg) |
| `ts/uuminutes/callSummaryExtensionService.preload.ts` | stav rozšíření + instalace |
| `ts/uuminutes/callTranscriptionService.preload.ts` | pipeline po uložení nahrávky |
| `ts/uuminutes/components/UuMinutesCallSummaryExtensionModal.dom.tsx` | dialog instalace |
| `stylesheets/components/UuMinutesCallSummaryExtension.scss` | styly dialogu |
| `app/uuminutes_icon.main.ts` | cesta k uuMinutes ikoně |
| `app/uuminutes_tray.main.ts` | tray ikona + tooltip uuMinutes |
| `images/uuminutes/app-icon-source.png` | zdrojová ikona (jednorožec) |
| `scripts/generate-uuminutes-icons.mjs` | generuje .ico + PNG velikosti |
| `scripts/generate-uuminutes-tray-icons.mjs` | tray ikony (base + badge) |
| `images/tray-icons/base/uuminutes-tray-icon-*` | vygenerované tray ikony |
| `images/tray-icons/alert/uuminutes-tray-icon-*` | tray ikony s počtem nepřečtených |
| `build/icons/uuminutes/**` | vygenerované ikony (gitignore volitelně) |
| `.github/workflows/uuminutes-ci.yml` | CI: generate + check:types |
| `.github/workflows/uuminutes-release.yml` | release instalátoru + GitHub Release |
| `.github/workflows/uuminutes-merge-upstream.yml` | merge Signal upstream → PR |
| `scripts/extract-changelog-release.mjs` | release notes z CHANGELOG.md |
| `CHANGELOG.md` | uživatelský changelog verzí |
| `CONTRIBUTING-UUMINUTES.md` | pravidla pro PR do Minutes |
| `.github/ISSUE_TEMPLATE/config.yml` | Minutes issue odkazy (místo Signal) |
| `.github/ISSUE_TEMPLATE/bug_report_minutes.yaml` | šablona bug reportu |
| `.github/ISSUE_TEMPLATE/feature_request_minutes.yaml` | šablona feature requestu |
