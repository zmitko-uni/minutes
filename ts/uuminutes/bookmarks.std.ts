// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type UuMinutesBookmark = Readonly<{
  id: string;
  conversationId: string;
  messageId: string;
  conversationTitle: string;
  messagePreview: string;
  messageTimestamp: number;
  createdAt: number;
}>;

export type AddBookmarkInput = Readonly<{
  conversationId: string;
  messageId: string;
  conversationTitle: string;
  messagePreview: string;
  messageTimestamp: number;
}>;
