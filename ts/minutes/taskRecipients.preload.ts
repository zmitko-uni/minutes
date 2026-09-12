// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

export type TaskRecipient = Readonly<{ id: string; title: string }>;

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Chaty, do kterých se dá poslat úkol — tedy lidé, ne skupiny. Skupinu
 * úmyslně nabízíme taky, protože schůzkový tým často má vlastní chat.
 */
export function listTaskRecipients(): ReadonlyArray<TaskRecipient> {
  const controller = window.ConversationController;
  if (controller == null) {
    return [];
  }

  return controller
    .getAll()
    .filter(conversation => !conversation.get('left'))
    .map(conversation => ({
      id: conversation.id,
      title: conversation.getTitle(),
    }))
    .filter(recipient => recipient.title.trim().length > 0)
    .sort((a, b) => a.title.localeCompare(b.title, 'cs'));
}

/**
 * Spáruje jméno navržené AI se Signal chatem. Nejdřív přesná shoda,
 * potom shoda na příjmení nebo jméno jako podřetězec.
 */
export function matchTaskRecipient(
  assignee: string,
  recipients: ReadonlyArray<TaskRecipient>
): string | null {
  const needle = normalizeName(assignee);
  if (needle.length === 0) {
    return null;
  }

  const exact = recipients.find(
    recipient => normalizeName(recipient.title) === needle
  );
  if (exact != null) {
    return exact.id;
  }

  const partial = recipients.find(recipient => {
    const title = normalizeName(recipient.title);
    return title.includes(needle) || needle.includes(title);
  });
  if (partial != null) {
    return partial.id;
  }

  const needleParts = needle.split(' ').filter(part => part.length > 2);
  const byNamePart = recipients.find(recipient => {
    const titleParts = normalizeName(recipient.title).split(' ');
    return needleParts.some(part => titleParts.includes(part));
  });

  return byNamePart?.id ?? null;
}
