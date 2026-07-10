// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import * as KeyboardLayout from '../services/keyboardLayout.dom.ts';
import { openTranscriptionQueuePanel } from './transcriptionQueueService.preload.ts';

function isOpenTranscriptionQueueShortcut(event: KeyboardEvent): boolean {
  const isMacOS = window.platform === 'darwin';
  const { ctrlKey, metaKey, shiftKey, altKey } = event;

  const commandKey = isMacOS && metaKey;
  const controlKey = !isMacOS && ctrlKey;
  const commandOrCtrl = commandKey || controlKey;

  if (!commandOrCtrl || !shiftKey || altKey) {
    return false;
  }

  const key = KeyboardLayout.lookup(event);
  return key === 'm' || key === 'M';
}

export function initializeMinutesKeyboardShortcuts(): void {
  document.addEventListener(
    'keydown',
    event => {
      if (!isOpenTranscriptionQueueShortcut(event)) {
        return;
      }

      openTranscriptionQueuePanel();
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    { capture: true }
  );
}
