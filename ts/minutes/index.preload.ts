// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { drop } from '../util/drop.std.ts';
import { callRecordingService } from './callRecordingService.preload.ts';
import { callRecordingFileService } from './callRecordingFileService.preload.ts';
import { enqueueRecordingTranscription } from './callTranscriptionService.preload.ts';
import { initializeMinutesLogBuffer } from './logBuffer.preload.ts';
import { refreshCallSummaryExtension } from './callSummaryExtensionService.preload.ts';
import { refreshLocalLlmExtension } from './localLlmExtensionService.preload.ts';
import { MINUTES_BUILD_ID } from './constants.std.ts';
import { showMinutesHome } from './homeNavigation.preload.ts';
import { openMinutesLog } from './navigation.preload.ts';
import { openReadmeModal } from './readmeService.preload.ts';
import { openMinutesBookmarks } from './bookmarksService.preload.ts';
import { openMinutesBusinessCards } from './personCardService.preload.ts';
import { getUubtSettings } from './uubtService.preload.ts';
import { initializeAppUpdate } from './appUpdateService.preload.ts';
import { initializeMinutesKeyboardShortcuts } from './keyboardShortcuts.preload.ts';
import { initializeAutomationRenderer } from './automation/automationRenderer.preload.ts';

const log = createLogger('minutes');
let minutesInitialized = false;

export function registerMinutesEarly(): void {
  if (window.minutes != null) {
    return;
  }

  window.minutes = {
    buildId: MINUTES_BUILD_ID,
    openLog: openMinutesLog,
    openReadme: openReadmeModal,
    showHome: showMinutesHome,
  };
}

registerMinutesEarly();

export function initializeMinutes(): void {
  if (minutesInitialized) {
    return;
  }
  minutesInitialized = true;

  log.info(`initializing minutes extensions (build ${MINUTES_BUILD_ID})`);
  initializeMinutesLogBuffer();

  registerMinutesEarly();

  drop(callRecordingService.prepare());
  drop(
    (async () => {
      const recovered = await callRecordingFileService.recoverInterrupted();
      for (const metadata of recovered) {
        enqueueRecordingTranscription(metadata);
      }
      if (recovered.length > 0) {
        log.info(
          `recovered ${recovered.length} interrupted call recording(s) after crash`
        );
      }
    })()
  );
  drop(refreshCallSummaryExtension());
  drop(refreshLocalLlmExtension());
  // Tab Vizitky se v levé navigaci ukazuje jen se zapnutou integrací Plus4U.
  drop(getUubtSettings());
  initializeAppUpdate();
  initializeMinutesKeyboardShortcuts();
  initializeAutomationRenderer();

  ipcRenderer.on('minutes:show-home', () => {
    showMinutesHome();
  });

  // Záložky, Přepisy i Vizitky jsou taby levé navigace; menu jen přepne lokaci.
  ipcRenderer.on('minutes:open-bookmarks', () => {
    openMinutesBookmarks();
  });

  ipcRenderer.on('minutes:open-business-cards', () => {
    openMinutesBusinessCards();
  });
}

export {
  callRecordingService,
  RECORDING_STATE_CHANGED,
} from './callRecordingService.preload.ts';
export {
  summarizeConversation,
  summarizeFromMessage,
  summarizeLastHours,
  summarizeSelectedConversation,
  openRecordingsFolder,
  openSummariesFolder,
} from './chatSummaryService.preload.ts';
export { summarizeUnreadConversations } from './unreadSummaryService.preload.ts';
export { MinutesCallRecordingControls } from './components/MinutesCallRecordingControls.dom.tsx';
export { MinutesSettingsHost } from './components/MinutesSettingsModal.dom.tsx';
export { MinutesAutomationSettingsHost } from './components/MinutesAutomationSettingsModal.dom.tsx';
export { MinutesCallSummaryExtensionHost } from './components/MinutesCallSummaryExtensionModal.dom.tsx';
export { openMinutesBookmarks } from './bookmarksService.preload.ts';
export { MinutesSummaryToastHost } from './components/MinutesSummaryToastHost.dom.tsx';
export { MinutesLogHost } from './components/MinutesLogModal.dom.tsx';
export { MinutesTranscriptionQueueHost } from './components/MinutesTranscriptionQueueHost.dom.tsx';
export { transcriptionQueue } from './transcriptionQueueService.preload.ts';
export { showMinutesTranscriptsTab } from './navTabsService.preload.ts';
export { markUnreadFromMessage } from './markUnreadFromMessage.preload.ts';
export {
  sendSummaryToChat,
  sendSummaryToSelf,
} from './sendSummaryToChat.preload.ts';
export {
  MinutesDropdownMenuItems,
  MinutesContextMenuItems,
} from './components/MinutesConversationMenuItems.dom.tsx';
