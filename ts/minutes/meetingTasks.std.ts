// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Úkoly navržené AI ze zápisu schůzky. Návrh je jen podklad — uživatel ho
 * před odesláním upravuje, takže se nikam neukládá automaticky.
 */
export type MeetingTaskDraft = Readonly<{
  id: string;
  /** Jméno, jak ho navrhla AI (nebo jak si ho uživatel přepsal). */
  assignee: string;
  /** Signal chat, kam se úkol pošle. `null` = uživatel ho ještě nevybral. */
  conversationId: string | null;
  title: string;
  detail: string;
  /** Volný text termínu, např. „do pátku“. AI ho nemusí navrhnout. */
  dueLabel: string;
}>;

export type MeetingTaskGroup = Readonly<{
  assignee: string;
  conversationId: string | null;
  tasks: ReadonlyArray<MeetingTaskDraft>;
}>;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Modely rády obalí JSON do bloku ```json nebo přidají větu navíc,
 * takže hledáme první pole v textu.
 */
function extractJsonArray(raw: string): string | null {
  const withoutFence = raw
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '');

  const start = withoutFence.indexOf('[');
  const end = withoutFence.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return withoutFence.slice(start, end + 1);
}

export function parseMeetingTaskProposals(
  raw: string
): ReadonlyArray<MeetingTaskDraft> {
  const json = extractJsonArray(raw);
  if (json == null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const tasks: Array<MeetingTaskDraft> = [];
  for (const [index, candidate] of parsed.entries()) {
    if (typeof candidate !== 'object' || candidate == null) {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const title = asTrimmedString(record.title ?? record.task ?? record.name);
    if (title.length === 0) {
      continue;
    }
    tasks.push({
      id: `task-${index}-${Date.now()}`,
      assignee: asTrimmedString(
        record.assignee ?? record.owner ?? record.person
      ),
      conversationId: null,
      title,
      detail: asTrimmedString(record.detail ?? record.description),
      dueLabel: asTrimmedString(record.due ?? record.dueLabel ?? record.term),
    });
  }

  return tasks;
}

export function createEmptyMeetingTask(assignee: string): MeetingTaskDraft {
  return {
    id: `task-new-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    assignee,
    conversationId: null,
    title: '',
    detail: '',
    dueLabel: '',
  };
}

/** Seskupí úkoly podle osoby, v pořadí prvního výskytu. */
export function groupMeetingTasksByAssignee(
  tasks: ReadonlyArray<MeetingTaskDraft>
): ReadonlyArray<MeetingTaskGroup> {
  const order: Array<string> = [];
  const byAssignee = new Map<string, Array<MeetingTaskDraft>>();

  for (const task of tasks) {
    const key = task.assignee.trim().length > 0 ? task.assignee.trim() : '—';
    let bucket = byAssignee.get(key);
    if (bucket == null) {
      bucket = [];
      byAssignee.set(key, bucket);
      order.push(key);
    }
    bucket.push(task);
  }

  return order.map(assignee => {
    const bucket = byAssignee.get(assignee) ?? [];
    return {
      assignee,
      conversationId:
        bucket.find(task => task.conversationId != null)?.conversationId ??
        null,
      tasks: bucket,
    };
  });
}

export function isMeetingTaskSendable(task: MeetingTaskDraft): boolean {
  return task.title.trim().length > 0 && task.conversationId != null;
}

/**
 * Formální zpráva, kterou Minutes pošlou řešiteli. Záměrně uvádí, odkud
 * úkoly vznikly, aby příjemce věděl, že je nesepsal člověk ručně.
 */
export function formatMeetingTaskMessage(
  options: Readonly<{
    meetingName: string;
    meetingDay: string;
    meetingTimeRange: string;
    sourceChatTitle: string;
    assignee: string;
    tasks: ReadonlyArray<MeetingTaskDraft>;
  }>
): string {
  const when = [options.meetingDay, options.meetingTimeRange]
    .filter(part => part.trim().length > 0)
    .join(', ');

  const intro =
    options.tasks.length === 1
      ? 'na vás vychází tento úkol'
      : 'na vás vycházejí tyto úkoly';

  const lines = options.tasks.map((task, index) => {
    const parts = [`${index + 1}. **${task.title.trim()}**`];
    if (task.detail.trim().length > 0) {
      parts.push(`   ${task.detail.trim()}`);
    }
    if (task.dueLabel.trim().length > 0) {
      parts.push(`   Termín: ${task.dueLabel.trim()}`);
    }
    return parts.join('\n');
  });

  const header = [
    `**Úkoly ze schůzky: ${options.meetingName}**`,
    '',
    `${options.assignee.trim().length > 0 ? `${options.assignee.trim()}, ` : ''}na základě chatu „${options.sourceChatTitle}“ a zápisu ze schůzky${when.length > 0 ? ` (${when})` : ''} ${intro}:`,
    '',
  ].join('\n');

  return `${header}${lines.join('\n\n')}\n`;
}
