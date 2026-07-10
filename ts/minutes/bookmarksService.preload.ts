// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import type { AddBookmarkInput, MinutesBookmark } from './bookmarks.std.ts';
import { summaryUi } from './summaryUiEvents.std.ts';

const log = createLogger('minutes/bookmarksService');

function buildMessagePreview(body: string | undefined): string {
  const trimmed = body?.trim() ?? '';
  if (trimmed.length === 0) {
    return '[zpráva bez textu]';
  }
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
}

export async function listBookmarks(): Promise<Array<MinutesBookmark>> {
  const bookmarks = await ipcRenderer.invoke('minutes:list-bookmarks');
  return Array.isArray(bookmarks) ? (bookmarks as Array<MinutesBookmark>) : [];
}

export async function addMessageBookmark(options: {
  conversationId: string;
  messageId: string;
}): Promise<MinutesBookmark | null> {
  const conversation =
    window.ConversationController.get(options.conversationId) ?? undefined;
  if (!conversation) {
    window.reduxActions.toast.showToast({
      toastType: ToastType.InvalidConversation,
    });
    return null;
  }

  const message = await getMessageById(options.messageId);
  if (!message) {
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return null;
  }

  if (message.get('conversationId') !== options.conversationId) {
    log.warn('addMessageBookmark: message conversation mismatch');
    return null;
  }

  const input: AddBookmarkInput = {
    conversationId: options.conversationId,
    messageId: options.messageId,
    conversationTitle: conversation.getTitle(),
    messagePreview: buildMessagePreview(message.get('body')),
    messageTimestamp:
      message.get('sent_at') ??
      message.get('received_at') ??
      message.get('timestamp') ??
      Date.now(),
  };

  try {
    const bookmark = await ipcRenderer.invoke('minutes:add-bookmark', input);
    summaryUi.showWorking('Zpráva přidána do záložek');
    setTimeout(() => summaryUi.hide(), 2200);
    return bookmark as MinutesBookmark;
  } catch (error) {
    log.error('addMessageBookmark failed', error);
    summaryUi.showError('Záložku se nepodařilo uložit.');
    return null;
  }
}

export async function removeBookmarkById(id: string): Promise<void> {
  await ipcRenderer.invoke('minutes:remove-bookmark', id);
}

export function navigateToBookmark(bookmark: MinutesBookmark): void {
  window.reduxActions.conversations.showConversation({
    conversationId: bookmark.conversationId,
    messageId: bookmark.messageId,
  });
}

export function openBookmarksModal(): void {
  ipcRenderer.send('minutes:open-bookmarks');
}
