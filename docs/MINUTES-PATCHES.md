# minutes — doteky upstream Signal Desktop

> **Klíčové pravidlo:** viz [`FORK-MAINTENANCE.md`](./FORK-MAINTENANCE.md)

## Povolené modifikace upstream (aktuální stav)

| Soubor | Co | Hook |
|--------|-----|------|
| `package.json` | productName, skripty | branding |
| `scripts/utils/parseVersion.mjs` | Minutes `-m` verze pro build skripty | regex větev |
| `app/user_config.main.ts` | `minutes-*` userData | 1 řádek |
| `app/startup_config.main.ts` | minutes AUMID + název aplikace | pár řádků |
| `app/WindowsNotifications.main.ts` | fallback toast + log AUMID | minutes |
| `app/minutes_readme.main.ts` | načtení příručky z disku |
| `app/main.main.ts` | IPC init, menu akce, minutes ikona, test pipeline hook (`MINUTES_TEST_PIPELINE=1`) | registrace |
| `app/SystemTrayService.main.ts` | tray ikona + tooltip minutes | 2 volání |
| `app/menu.std.ts` | submenu minutes + Příručka | menu |
| `ts/types/menu.std.ts` | typy menu akcí | menu |
| `ts/services/calling.preload.ts` | `onCallEnded` při konci hovoru | 2 volání |
| `ts/background.preload.ts` | init + IPC summarize, build expiration | bootstrap |
| `ts/components/CallScreen.dom.tsx` | `<MinutesCallRecordingControls />` | 1 komponenta |
| `ts/components/ChatsTab.dom.tsx` | minutes uvítací obrazovka | 1 komponenta |
| `ts/components/App.dom.tsx` | minutes host komponenty | +TranscriptionQueueHost, bez update banneru |
| `ts/components/conversation/MessageContextMenu.dom.tsx` | `onBookmarkMessage`, `onMarkUnreadFromHere`, `onAskAiOpinion` | props + items |
| `ts/components/conversation/TimelineMessage.dom.tsx` | callback záložky, nepřečteno, názor AI | callbacks |
| `app/startup_config.main.ts` | AUMID + název Minutes / Minutes Beta | releaseChannel |
| `app/user_config.main.ts` | `%APPDATA%\Minutes` vs `Minutes-Beta` | releaseChannel |
| `electron-builder.minutes.mjs` | prod vs beta instalátor | MINUTES_RELEASE_CHANNEL |
| `ts/minutes/bookmarks.std.ts` | typy záložek |
| `ts/minutes/bookmarks.main.ts` | persist JSON |
| `ts/minutes/bookmarksService.preload.ts` | add/list/navigate |
| `ts/minutes/sendAiOpinionToChat.preload.ts` | odeslání názoru AI do chatu / sobě |
| `ts/minutes/askAiOpinionService.preload.ts` | názor AI na zprávu → banner |
| `ts/minutes/aiOpinionPrompts.std.ts` | prompty pro názor AI |
| `ts/minutes/aiSummaryPrompts.std.ts` | prompty + sanitizace shrnutí chatu |
| `ts/minutes/releaseChannel.std.ts` | prod/beta kanál, data dir, updaty |
| `config/minutes-beta.json` | konfigurace profilu minutes-beta |
| `ts/minutes/components/MinutesBookmarksModal.dom.tsx` | dialog Záložky |
| `stylesheets/components/MinutesBookmarks.scss` | styly záložek |
| `ts/minutes/buildExpiration.preload.ts` | vypnutí expirace buildu |
| `ts/minutes/welcomeContent.std.ts` | texty uvítací obrazovky + dlaždice |
| `ts/minutes/components/MinutesWelcomeSplash.dom.tsx` | uvítání + 4 dlaždice |
| `ts/minutes/readmeService.preload.ts` | otevření modalu příručky |
| `ts/minutes/components/MinutesReadmeModal.dom.tsx` | modal příručky (Markdown) |
| `ts/minutes/components/MinutesMarkdown.dom.tsx` | render Markdown |
| `stylesheets/components/MinutesReadme.scss` | styly příručky |
| `stylesheets/components/MinutesStartupSplash.scss` | logo při startu aplikace |
| `images/minutes/prirucka.md` | uživatelská příručka (součást balíčku) |
| `background.html` | preload + title Minutes | startup logo |
| `loading.html` | preload ikony Minutes | migrace |

## Nové soubory (ne upstream)

| Cesta | Účel |
|-------|------|
| `ts/minutes/**` | business logika, UI komponenty |
| `app/minutes_channel.main.ts` | main-process IPC |
| `app/minutes_runtime.main.ts` | výchozí `NODE_CONFIG_ENV=minutes` pro balíček |
| `electron-builder.minutes.mjs` | NSIS profil (sloučení s package.json#build) |
| `scripts/build-minutes-installer.mjs` | build Windows instalátoru |
| `scripts/patch-electron-icon.mjs` | ikona electron.exe pro dev na Windows |
| `ts/minutes/aiSettings.std.ts` | typy + výchozí model |
| `ts/minutes/aiSettings.main.ts` | uložení klíče (safeStorage) |
| `ts/minutes/branding.std.ts` | zobrazovaný název Minutes (centrální branding) |
| `ts/minutes/aiSummaryService.main.ts` | směrování AI sumarizace podle poskytovatele |
| `ts/minutes/localLlmSettings.std.ts` | katalog GGUF modelů Gemma |
| `ts/minutes/localLlmExtension.*` | stažení + inference lokálního LLM |
| `ts/minutes/localLlmInference.main.ts` | node-llama-cpp chat session |
| `ts/minutes/components/MinutesLocalLlmPanel.dom.tsx` | panel instalace v Nastavení AI |
| `package.json` + `rolldown.config.ts` | závislost `node-llama-cpp` (native, external) |
| `ts/minutes/perplexitySummary.main.ts` | Perplexity API (bez web search) |
| `ts/minutes/anthropicSummary.main.ts` | Anthropic Claude API |
| `ts/minutes/aiSettingsService.preload.ts` | preload IPC wrapper |
| `ts/minutes/components/MinutesSettingsModal.dom.tsx` | dialog AI nastavení |
| `ts/minutes/appUpdate.*` | kontrola GitHub Releases, stažení, pending update |
| `ts/minutes/unreadSummaryService.preload.ts` | přehled nepřečtených chatů → Poznámky |
| `ts/minutes/markUnreadFromMessage.preload.ts` | Nepřečteno odsud v kontextovém menu zprávy |
| `ts/sql/Server.node.ts` | `markMessagesUnreadFromAnchor` — SQL UPDATE readStatus/seenStatus |
| `ts/sql/Interface.std.ts` | typ pro `markMessagesUnreadFromAnchor` |
| `ts/minutes/components/MinutesAppUpdateBannerHost.dom.tsx` | banner aktualizace při startu |
| `ts/minutes/components/MinutesVersionFooter.dom.tsx` | patička verze na domovské obrazovce |
| `ts/minutes/components/MinutesSummaryToastHost.dom.tsx` | toast + odeslání do chatu |
| `stylesheets/components/MinutesSummaryToast.scss` | styly toastu |
| `stylesheets/manifest.scss` | import SCSS | 1 řádek |
| `ts/minutes/callSummaryExtension.std.ts` | typy rozšíření Sumarizace hovoru |
| `ts/minutes/callSummaryExtension.main.ts` | stažení modelu, přepis, uložení |
| `ts/minutes/whisperSettings.std.ts` | jazyk cs, prompt, výchozí Whisper model |
| `ts/minutes/audioPcm.dom.ts` | MP3 → PCM přes Web Audio (bez ffmpeg) |
| `ts/minutes/callSummaryExtensionService.preload.ts` | stav rozšíření + instalace |
| `ts/minutes/callTranscriptionService.preload.ts` | pipeline po uložení nahrávky |
| `ts/minutes/components/MinutesCallSummaryExtensionModal.dom.tsx` | dialog instalace |
| `stylesheets/components/MinutesCallSummaryExtension.scss` | styly dialogu |
| `app/minutes_icon.main.ts` | cesta k minutes ikoně |
| `app/minutes_tray.main.ts` | tray ikona + tooltip minutes |
| `images/minutes/app-icon-source.png` | zdrojová ikona Minutes (M + skupina) |
| `scripts/generate-minutes-icons.mjs` | generuje .ico + PNG velikosti |
| `scripts/generate-minutes-tray-icons.mjs` | tray ikony (base + badge) |
| `images/tray-icons/base/minutes-tray-icon-*` | vygenerované tray ikony |
| `images/tray-icons/alert/minutes-tray-icon-*` | tray ikony s počtem nepřečtených |
| `build/icons/minutes/**` | vygenerované ikony (gitignore volitelně) |
| `.github/workflows/minutes-ci.yml` | CI: generate + check:types |
| `.github/workflows/minutes-release.yml` | release instalátoru + GitHub Release |
| `.github/workflows/minutes-merge-upstream.yml` | merge Signal upstream → PR |
| `scripts/extract-changelog-release.mjs` | release notes z CHANGELOG.md |
| `CHANGELOG.md` | uživatelský changelog verzí |
| `CONTRIBUTING-MINUTES.md` | pravidla pro PR do Minutes |
| `.github/ISSUE_TEMPLATE/config.yml` | Minutes issue odkazy (místo Signal) |
| `.github/ISSUE_TEMPLATE/bug_report_minutes.yaml` | šablona bug reportu |
| `.github/ISSUE_TEMPLATE/feature_request_minutes.yaml` | šablona feature requestu |
