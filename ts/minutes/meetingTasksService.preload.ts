// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { ipcRenderer } from 'electron';

import {
  parseMeetingTaskProposals,
  type MeetingTaskDraft,
} from './meetingTasks.std.ts';

export async function proposeMeetingTasks(
  options: Readonly<{
    meetingName: string;
    meetingWhen: string;
    sourceChatTitle: string;
    participants: ReadonlyArray<string>;
    minutesMarkdown: string;
  }>
): Promise<ReadonlyArray<MeetingTaskDraft>> {
  const raw = (await ipcRenderer.invoke('minutes:propose-meeting-tasks', {
    meetingName: options.meetingName,
    meetingWhen: options.meetingWhen,
    sourceChatTitle: options.sourceChatTitle,
    participants: [...options.participants],
    minutesMarkdown: options.minutesMarkdown,
  })) as string;

  return parseMeetingTaskProposals(raw);
}
