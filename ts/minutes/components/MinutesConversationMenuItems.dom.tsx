// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { AxoDropdownMenu } from '../../axo/AxoDropdownMenu.dom.tsx';
import { AxoContextMenu } from '../../axo/AxoContextMenu.dom.tsx';
import { createLogger } from '../../logging/log.std.ts';
import { drop } from '../../util/drop.std.ts';
import { summarizeLastHours } from '../chatSummaryService.preload.ts';
import {
  MINUTES_MENU_LABEL,
  MINUTES_MENU_OPEN_RECORDINGS,
  MINUTES_MENU_OPEN_SUMMARIES,
  MINUTES_MENU_SHOW_LOG,
  MINUTES_MENU_SUMMARIZE_1H,
  MINUTES_MENU_SUMMARIZE_8H,
  MINUTES_MENU_SUMMARIZE_24H,
} from '../menuLabels.std.ts';
import {
  openRecordingsFolder,
  openSummariesFolder,
  openMinutesLog,
} from '../navigation.preload.ts';

const log = createLogger('minutes/menu');

function runSummarize(
  conversationId: string,
  hours: 1 | 8 | 24
): void {
  log.info(`summarize clicked: conversation=${conversationId} hours=${hours}`);
  drop(
    summarizeLastHours(conversationId, hours).catch(error => {
      log.error(
        `summarize failed from menu: ${error instanceof Error ? error.message : String(error)}`
      );
    })
  );
}

function useHandlers(conversationId: string) {
  return {
    onSummarize1h: () => runSummarize(conversationId, 1),
    onSummarize8h: () => runSummarize(conversationId, 8),
    onSummarize24h: () => runSummarize(conversationId, 24),
    onOpenRecordings: () => drop(openRecordingsFolder()),
    onOpenSummaries: () => drop(openSummariesFolder()),
    onShowLog: () => openMinutesLog(),
  };
}

export function MinutesDropdownMenuItems({
  conversationId,
}: Readonly<{ conversationId: string }>): JSX.Element {
  const handlers = useHandlers(conversationId);

  return (
    <>
      <AxoDropdownMenu.Separator />
      <AxoDropdownMenu.Label>{MINUTES_MENU_LABEL}</AxoDropdownMenu.Label>
      <AxoDropdownMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize1h}
      >
        {MINUTES_MENU_SUMMARIZE_1H}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize8h}
      >
        {MINUTES_MENU_SUMMARIZE_8H}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize24h}
      >
        {MINUTES_MENU_SUMMARIZE_24H}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Separator />
      <AxoDropdownMenu.Item
        symbol="folder"
        onSelect={handlers.onOpenRecordings}
      >
        {MINUTES_MENU_OPEN_RECORDINGS}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item symbol="folder" onSelect={handlers.onOpenSummaries}>
        {MINUTES_MENU_OPEN_SUMMARIES}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item symbol="info" onSelect={handlers.onShowLog}>
        {MINUTES_MENU_SHOW_LOG}
      </AxoDropdownMenu.Item>
    </>
  );
}

export function MinutesContextMenuItems({
  conversationId,
}: Readonly<{ conversationId: string }>): JSX.Element {
  const handlers = useHandlers(conversationId);

  return (
    <>
      <AxoContextMenu.Separator />
      <AxoContextMenu.Label>{MINUTES_MENU_LABEL}</AxoContextMenu.Label>
      <AxoContextMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize1h}
      >
        {MINUTES_MENU_SUMMARIZE_1H}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize8h}
      >
        {MINUTES_MENU_SUMMARIZE_8H}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize24h}
      >
        {MINUTES_MENU_SUMMARIZE_24H}
      </AxoContextMenu.Item>
      <AxoContextMenu.Separator />
      <AxoContextMenu.Item
        symbol="folder"
        onSelect={handlers.onOpenRecordings}
      >
        {MINUTES_MENU_OPEN_RECORDINGS}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item symbol="folder" onSelect={handlers.onOpenSummaries}>
        {MINUTES_MENU_OPEN_SUMMARIES}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item symbol="info" onSelect={handlers.onShowLog}>
        {MINUTES_MENU_SHOW_LOG}
      </AxoContextMenu.Item>
    </>
  );
}
