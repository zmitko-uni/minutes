// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type MinutesBookmark = Readonly<{
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
