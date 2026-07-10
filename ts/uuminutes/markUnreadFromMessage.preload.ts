// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { isStory } from '../messages/helpers.std.ts';
import { ReadStatus } from '../messages/MessageReadStatus.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { DataReader, DataWriter } from '../sql/Client.preload.ts';
import type { MessageType } from '../sql/Interface.std.ts';
import { SeenStatus } from '../MessageSeenStatus.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import * as Errors from '../types/errors.std.ts';
import { postSaveUpdates } from '../util/cleanup.preload.ts';
import { itemStorage } from '../textsecure/Storage.preload.ts';

const log = createLogger('uuminutes/markUnreadFromMessage');

const MESSAGE_BATCH_SIZE = 100;
const MAX_MESSAGES_TO_MARK = 500;

function canMarkMessageUnread(message: MessageType): boolean {
  if (isStory(message)) {
    return false;
  }
  if (message.type === 'outgoing' || message.type === 'call-history') {
    return false;
  }
  return true;
}

function shouldMarkMessageUnread(message: MessageType): boolean {
  if (!canMarkMessageUnread(message)) {
    return false;
  }
  return message.readStatus !== ReadStatus.Unread;
}

async function loadMessagesFromAnchor(
  conversationId: string,
  anchor: MessageType
): Promise<Array<MessageType>> {
  const messages: Array<MessageType> = [anchor];
  let messageId = anchor.id;
  let sentAt = anchor.sent_at;
  let receivedAt = anchor.received_at;

  for (
    let batchIndex = 0;
    batchIndex < MAX_MESSAGES_TO_MARK / MESSAGE_BATCH_SIZE;
    batchIndex += 1
  ) {
    // oxlint-disable-next-line no-await-in-loop
    const batch = await DataReader.getNewerMessagesByConversation({
      conversationId,
      messageId,
      sentAt,
      receivedAt,
      limit: MESSAGE_BATCH_SIZE,
      includeStoryReplies: false,
      storyId: undefined,
    });

    if (batch.length === 0) {
      break;
    }

    messages.push(...batch);

    const newest = batch[batch.length - 1];
    if (newest == null) {
      break;
    }
    messageId = newest.id;
    sentAt = newest.sent_at;
    receivedAt = newest.received_at;

    if (batch.length < MESSAGE_BATCH_SIZE) {
      break;
    }
  }

  if (messages.length > MAX_MESSAGES_TO_MARK) {
    return messages.slice(0, MAX_MESSAGES_TO_MARK);
  }

  return messages;
}

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

    const anchorAttributes = anchor.attributes;
    const messages = await loadMessagesFromAnchor(
      conversationId,
      anchorAttributes
    );

    const updatedMessages = messages
      .filter(shouldMarkMessageUnread)
      .map(message => ({
        ...message,
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
      }));

    if (updatedMessages.length === 0) {
      window.reduxActions.toast.showToast({
        toastType: ToastType.ConversationMarkedUnread,
      });
      return;
    }

    for (const message of updatedMessages) {
      const cached = window.MessageCache.getById(message.id);
      cached?.set({
        readStatus: ReadStatus.Unread,
        seenStatus: SeenStatus.Unseen,
      });
    }

    await DataWriter.saveMessages(updatedMessages, {
      forceSave: true,
      ourAci: itemStorage.user.getCheckedAci(),
      postSaveUpdates,
    });

    const conversation = window.ConversationController.get(conversationId);
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
