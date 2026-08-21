// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { ForwardMessagesModalType } from '../components/ForwardMessagesModal.dom.tsx';
import { createLogger } from '../logging/log.std.ts';
import { getMessageById } from '../messages/getMessageById.preload.ts';
import type { ForwardMessagePropsType } from '../state/ducks/globalModals.preload.ts';
import { getMessagePropsSelector } from '../state/selectors/message.preload.ts';
import { applyRangesToText } from '../types/BodyRange.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { sortByMessageOrder } from '../types/ForwardDraft.std.ts';
import * as Errors from '../types/errors.std.ts';
import {
  addContextToForwardDraft,
  formatMessagesWithContextForClipboard,
  type MessageContext,
} from './contextForward.std.ts';
import { getLocalSpeakerDisplayName } from './localSpeakerName.preload.ts';
import { MINUTES_FORWARD_WITH_CONTEXT_MODAL_TITLE } from './menuLabels.std.ts';

const log = createLogger('minutes/contextForward');

function getContext(props: ForwardMessagePropsType): MessageContext {
  return {
    author: props.author.isMe
      ? getLocalSpeakerDisplayName()
      : props.author.title,
    timestamp: props.timestamp,
  };
}

function getClipboardBody(props: ForwardMessagePropsType): string {
  const text = applyRangesToText(
    {
      body: props.text ?? '',
      bodyRanges: props.bodyRanges ?? [],
    },
    {
      replaceMentions: true,
      replaceSpoilers: false,
    }
  ).body.trim();
  if (text) {
    return text;
  }
  if (props.isSticker) {
    return '[Nálepka]';
  }
  if (props.contact) {
    return '[Kontakt]';
  }
  if (props.attachments?.length) {
    return props.attachments
      .map(attachment =>
        attachment.fileName ? `[Příloha: ${attachment.fileName}]` : '[Příloha]'
      )
      .join('\n');
  }
  return '[Zpráva bez textu]';
}

export function forwardMessagesWithContext(
  messageIds: ReadonlyArray<string>,
  onForward?: () => void
): void {
  const i18n = window.SignalContext.i18n;
  window.reduxActions.globalModals.toggleForwardMessagesModal(
    {
      type: ForwardMessagesModalType.Forward,
      messageIds,
      modalTitle: MINUTES_FORWARD_WITH_CONTEXT_MODAL_TITLE,
      transformDraft: (draft, props) =>
        addContextToForwardDraft(draft, getContext(props), i18n.getLocale()),
    },
    onForward
  );
}

export async function copyMessagesWithContext(
  messageIds: ReadonlyArray<string>
): Promise<boolean> {
  try {
    const loaded = await Promise.all(
      messageIds.map(async messageId => {
        const message = await getMessageById(messageId);
        if (!message) {
          throw new Error(`Message not found: ${messageId}`);
        }
        return message;
      })
    );
    const sorted = sortByMessageOrder(loaded, message => message.attributes);
    const selector = getMessagePropsSelector(window.reduxStore.getState());
    const messages = sorted.map(message => {
      const props = selector(message.attributes);
      return {
        context: getContext(props),
        body: getClipboardBody(props),
      };
    });
    const text = formatMessagesWithContextForClipboard(
      messages,
      window.SignalContext.i18n.getLocale()
    );
    await window.navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    log.error(`copy failed: ${Errors.toLogFormat(error)}`);
    window.reduxActions.toast.showToast({ toastType: ToastType.Error });
    return false;
  }
}

export async function copySelectedMessagesWithContext(
  messageIds: ReadonlyArray<string>
): Promise<void> {
  if (messageIds.length > 0 && (await copyMessagesWithContext(messageIds))) {
    window.reduxActions.conversations.toggleSelectMode(false);
  }
}

export function forwardSelectedMessagesWithContext(
  messageIds: ReadonlyArray<string>
): void {
  if (messageIds.length === 0) {
    return;
  }
  forwardMessagesWithContext(messageIds, () => {
    window.reduxActions.conversations.toggleSelectMode(false);
  });
}
