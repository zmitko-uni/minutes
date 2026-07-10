// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { app } from 'electron';

import { createLogger } from '../logging/log.std.ts';
import { AI_SETTINGS_DIR_NAME } from './constants.std.ts';
import type { AddBookmarkInput, MinutesBookmark } from './bookmarks.std.ts';

const log = createLogger('minutes/bookmarks');

const BOOKMARKS_FILE_NAME = 'bookmarks.json';

type StoredBookmarks = {
  bookmarks: Array<MinutesBookmark>;
};

function getBookmarksPath(): string {
  return join(app.getPath('userData'), AI_SETTINGS_DIR_NAME, BOOKMARKS_FILE_NAME);
}

async function readStored(): Promise<StoredBookmarks> {
  try {
    const raw = await readFile(getBookmarksPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredBookmarks>;
    if (!Array.isArray(parsed.bookmarks)) {
      return { bookmarks: [] };
    }
    return { bookmarks: parsed.bookmarks };
  } catch {
    return { bookmarks: [] };
  }
}

async function writeStored(stored: StoredBookmarks): Promise<void> {
  const path = getBookmarksPath();
  await mkdir(join(app.getPath('userData'), AI_SETTINGS_DIR_NAME), {
    recursive: true,
  });
  await writeFile(path, JSON.stringify(stored, null, 2), 'utf8');
}

export async function listBookmarks(): Promise<Array<MinutesBookmark>> {
  const stored = await readStored();
  return stored.bookmarks.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addBookmark(
  input: AddBookmarkInput
): Promise<MinutesBookmark> {
  const stored = await readStored();
  const existingIndex = stored.bookmarks.findIndex(
    bookmark =>
      bookmark.conversationId === input.conversationId &&
      bookmark.messageId === input.messageId
  );

  if (existingIndex >= 0) {
    const existing = stored.bookmarks[existingIndex];
    if (existing == null) {
      throw new Error('bookmark index out of sync');
    }
    const updated: MinutesBookmark = {
      ...existing,
      conversationTitle: input.conversationTitle,
      messagePreview: input.messagePreview,
      messageTimestamp: input.messageTimestamp,
      createdAt: Date.now(),
    };
    stored.bookmarks[existingIndex] = updated;
    await writeStored(stored);
    log.info(`bookmark updated: ${updated.id}`);
    return updated;
  }

  const bookmark: MinutesBookmark = {
    id: randomUUID(),
    conversationId: input.conversationId,
    messageId: input.messageId,
    conversationTitle: input.conversationTitle,
    messagePreview: input.messagePreview,
    messageTimestamp: input.messageTimestamp,
    createdAt: Date.now(),
  };

  stored.bookmarks.unshift(bookmark);
  await writeStored(stored);
  log.info(`bookmark added: ${bookmark.id}`);
  return bookmark;
}

export async function removeBookmark(id: string): Promise<boolean> {
  const stored = await readStored();
  const next = stored.bookmarks.filter(bookmark => bookmark.id !== id);
  if (next.length === stored.bookmarks.length) {
    return false;
  }
  await writeStored({ bookmarks: next });
  log.info(`bookmark removed: ${id}`);
  return true;
}
