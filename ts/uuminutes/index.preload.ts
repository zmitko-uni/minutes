// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { drop } from '../util/drop.std.ts';
import { callRecordingService } from './callRecordingService.preload.ts';
import { initializeUuMinutesLogBuffer } from './logBuffer.preload.ts';
import { refreshCallSummaryExtension } from './callSummaryExtensionService.preload.ts';
import { refreshLocalLlmExtension } from './localLlmExtensionService.preload.ts';
import { UUMINUTES_BUILD_ID } from './constants.std.ts';
import { showMinutesHome } from './homeNavigation.preload.ts';
import { openUuMinutesLog } from './navigation.preload.ts';
import { openReadmeModal } from './readmeService.preload.ts';
import { initializeAppUpdate } from './appUpdateService.preload.ts';

const log = createLogger('uuminutes');

export function registerUuMinutesEarly(): void {
  if (window.uuMinutes != null) {
    return;
  }

  window.uuMinutes = {
    buildId: UUMINUTES_BUILD_ID,
    openLog: openUuMinutesLog,
    openReadme: openReadmeModal,
    showHome: showMinutesHome,
  };
}

registerUuMinutesEarly();

export function initializeUuMinutes(): void {
  log.info(`initializing uuMinutes extensions (build ${UUMINUTES_BUILD_ID})`);
  initializeUuMinutesLogBuffer();

  registerUuMinutesEarly();

  drop(callRecordingService.prepare());
  drop(refreshCallSummaryExtension());
  drop(refreshLocalLlmExtension());
  initializeAppUpdate();

  ipcRenderer.on('uuminutes:show-home', () => {
    showMinutesHome();
  });
}

export { callRecordingService, RECORDING_STATE_CHANGED } from './callRecordingService.preload.ts';
export {
  summarizeConversation,
  summarizeFromMessage,
  summarizeLastHours,
  summarizeSelectedConversation,
  openRecordingsFolder,
  openSummariesFolder,
} from './chatSummaryService.preload.ts';
export { summarizeUnreadConversations } from './unreadSummaryService.preload.ts';
export { UuMinutesCallRecordingControls } from './components/UuMinutesCallRecordingControls.dom.tsx';
export { UuMinutesSettingsHost } from './components/UuMinutesSettingsModal.dom.tsx';
export { UuMinutesCallSummaryExtensionHost } from './components/UuMinutesCallSummaryExtensionModal.dom.tsx';
export { UuMinutesBookmarksHost } from './components/UuMinutesBookmarksModal.dom.tsx';
export { openBookmarksModal } from './bookmarksService.preload.ts';
export { UuMinutesSummaryToastHost } from './components/UuMinutesSummaryToastHost.dom.tsx';
export { UuMinutesLogHost } from './components/UuMinutesLogModal.dom.tsx';
export { UuMinutesTranscriptionQueueHost } from './components/UuMinutesTranscriptionQueueHost.dom.tsx';
export {
  openTranscriptionQueuePanel,
  transcriptionQueue,
} from './transcriptionQueueService.preload.ts';
export { sendSummaryToChat, sendSummaryToSelf } from './sendSummaryToChat.preload.ts';
export {
  UuMinutesDropdownMenuItems,
  UuMinutesContextMenuItems,
} from './components/UuMinutesConversationMenuItems.dom.tsx';
