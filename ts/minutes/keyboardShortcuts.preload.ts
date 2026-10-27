// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { showMinutesTranscriptsTab } from './navTabsService.preload.ts';

function isOpenTranscriptionQueueShortcut(event: KeyboardEvent): boolean {
  const isMacOS = window.platform === 'darwin';
  const { ctrlKey, metaKey, shiftKey, altKey } = event;

  const commandKey = isMacOS && metaKey;
  const controlKey = !isMacOS && ctrlKey;
  const commandOrCtrl = commandKey || controlKey;

  if (!commandOrCtrl || !shiftKey || altKey) {
    return false;
  }

  return event.key === 'm' || event.key === 'M';
}

export function initializeMinutesKeyboardShortcuts(): void {
  document.addEventListener(
    'keydown',
    event => {
      if (!isOpenTranscriptionQueueShortcut(event)) {
        return;
      }

      showMinutesTranscriptsTab();
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true }
  );
}
