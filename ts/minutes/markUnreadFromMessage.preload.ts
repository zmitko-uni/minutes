// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { isStory } from '../messages/helpers.std.ts';
import { ReadStatus } from '../messages/MessageReadStatus.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { DataWriter } from '../sql/Client.preload.ts';
import { SeenStatus } from '../MessageSeenStatus.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import { isGroup } from '../util/whatTypeOfConversation.dom.ts';

const log = createLogger('minutes/markUnreadFromMessage');

export async function markUnreadFromMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  try {
    const anchor = await getMessageById(messageId);
    if (!anchor || anchor.get('conversationId') !== conversationId) {
      log.warn(`markUnreadFromMessage: message not found (${messageId})`);
      window.reduxActions.toast.showToast({ toastType: ToastType.Error });
      return;
    }

    if (isStory(anchor.attributes)) {
      window.reduxActions.toast.showToast({ toastType: ToastType.Error });
      return;
    }

    const conversation = window.ConversationController.get(conversationId);
    const includeStoryReplies = conversation
      ? !isGroup(conversation.attributes)
      : false;

    const updatedMessages = await DataWriter.markMessagesUnreadFromAnchor({
      conversationId,
      receivedAt: anchor.get('received_at'),
      sentAt: anchor.get('sent_at'),
      includeStoryReplies,
      storyId: undefined,
    });

    if (updatedMessages.length === 0) {
      window.reduxActions.toast.showToast({
        toastType: ToastType.ConversationMarkedUnread,
      });
      return;
    }

    for (const { id } of updatedMessages) {
      window.MessageCache.getById(id)?.set({
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
      });
    }

    if (conversation) {
      conversation.setMarkedUnread(false);
      conversation.throttledUpdateUnread();
    }

    log.info(
      `markUnreadFromMessage: marked ${updatedMessages.length} messages unread in ${conversationId}`
    );

    window.reduxActions.toast.showToast({
      toastType: ToastType.ConversationMarkedUnread,
    });
  } catch (error) {
    log.error(`markUnreadFromMessage failed: ${Errors.toLogFormat(error)}`);
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
  }
}
