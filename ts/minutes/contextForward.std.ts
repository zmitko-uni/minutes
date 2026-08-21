// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { BodyRange } from '../types/BodyRange.std.ts';
import type { MessageForwardDraft } from '../types/ForwardDraft.std.ts';

export type MessageContext = Readonly<{
  author: string;
  timestamp: number;
}>;

export function formatMessageContextHeader(
  context: MessageContext,
  locale: string,
  timeZone?: string
): string {
  const timestamp = new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(context.timestamp);
  return `${context.author} · ${timestamp}`;
}

export function addContextToForwardDraft(
  draft: MessageForwardDraft,
  context: MessageContext,
  locale: string,
  timeZone?: string
): MessageForwardDraft {
  const header = formatMessageContextHeader(context, locale, timeZone);
  const separator = draft.messageBody ? '\n' : '';
  const offset = header.length + separator.length;

  return {
    ...draft,
    messageBody: `${header}${separator}${draft.messageBody ?? ''}`,
    bodyRanges: [
      {
        start: 0,
        length: header.length,
        style: BodyRange.Style.BOLD,
      },
      ...(draft.bodyRanges ?? []).map(range => ({
        ...range,
        start: range.start + offset,
      })),
    ],
  };
}

export function formatMessagesWithContextForClipboard(
  messages: ReadonlyArray<Readonly<{ context: MessageContext; body: string }>>,
  locale: string,
  timeZone?: string
): string {
  return messages
    .map(({ context, body }) => {
      const header = formatMessageContextHeader(context, locale, timeZone);
      return body ? `${header}\n${body}` : header;
    })
    .join('\n\n');
}
