// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { LOCAL_SPEAKER_LEGACY_LABEL } from './speakerActivity.std.ts';

export function getLocalSpeakerDisplayName(): string {
  const ourId = window.ConversationController.getOurConversationId();
  if (!ourId) {
    return LOCAL_SPEAKER_LEGACY_LABEL;
  }

  const conversation = window.ConversationController.get(ourId);
  if (!conversation) {
    return LOCAL_SPEAKER_LEGACY_LABEL;
  }

  const profileName = conversation.getProfileName()?.trim();
  if (profileName && profileName.length > 0) {
    return profileName;
  }

  const title = conversation.getTitleNoDefault()?.trim();
  if (title && title.length > 0) {
    return title;
  }

  const fallbackTitle = conversation.getTitle()?.trim();
  if (fallbackTitle && fallbackTitle.length > 0) {
    return fallbackTitle;
  }

  return LOCAL_SPEAKER_LEGACY_LABEL;
}
