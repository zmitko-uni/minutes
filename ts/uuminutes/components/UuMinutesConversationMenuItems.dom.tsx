// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX } from 'react';

import { AxoDropdownMenu } from '../../axo/AxoDropdownMenu.dom.tsx';
import { AxoContextMenu } from '../../axo/AxoContextMenu.dom.tsx';
import { createLogger } from '../../logging/log.std.ts';
import { drop } from '../../util/drop.std.ts';
import { summarizeLastHours } from '../chatSummaryService.preload.ts';
import {
  UUMINUTES_MENU_LABEL,
  UUMINUTES_MENU_OPEN_RECORDINGS,
  UUMINUTES_MENU_OPEN_SUMMARIES,
  UUMINUTES_MENU_SHOW_LOG,
  UUMINUTES_MENU_SUMMARIZE_1H,
  UUMINUTES_MENU_SUMMARIZE_8H,
  UUMINUTES_MENU_SUMMARIZE_24H,
} from '../menuLabels.std.ts';
import {
  openRecordingsFolder,
  openSummariesFolder,
  openUuMinutesLog,
} from '../navigation.preload.ts';

const log = createLogger('uuminutes/menu');

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
    onShowLog: () => openUuMinutesLog(),
  };
}

export function UuMinutesDropdownMenuItems({
  conversationId,
}: Readonly<{ conversationId: string }>): JSX.Element {
  const handlers = useHandlers(conversationId);

  return (
    <>
      <AxoDropdownMenu.Separator />
      <AxoDropdownMenu.Label>{UUMINUTES_MENU_LABEL}</AxoDropdownMenu.Label>
      <AxoDropdownMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize1h}
      >
        {UUMINUTES_MENU_SUMMARIZE_1H}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize8h}
      >
        {UUMINUTES_MENU_SUMMARIZE_8H}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize24h}
      >
        {UUMINUTES_MENU_SUMMARIZE_24H}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Separator />
      <AxoDropdownMenu.Item
        symbol="folder"
        onSelect={handlers.onOpenRecordings}
      >
        {UUMINUTES_MENU_OPEN_RECORDINGS}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item symbol="folder" onSelect={handlers.onOpenSummaries}>
        {UUMINUTES_MENU_OPEN_SUMMARIES}
      </AxoDropdownMenu.Item>
      <AxoDropdownMenu.Item symbol="info" onSelect={handlers.onShowLog}>
        {UUMINUTES_MENU_SHOW_LOG}
      </AxoDropdownMenu.Item>
    </>
  );
}

export function UuMinutesContextMenuItems({
  conversationId,
}: Readonly<{ conversationId: string }>): JSX.Element {
  const handlers = useHandlers(conversationId);

  return (
    <>
      <AxoContextMenu.Separator />
      <AxoContextMenu.Label>{UUMINUTES_MENU_LABEL}</AxoContextMenu.Label>
      <AxoContextMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize1h}
      >
        {UUMINUTES_MENU_SUMMARIZE_1H}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize8h}
      >
        {UUMINUTES_MENU_SUMMARIZE_8H}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item
        symbol="note"
        onSelect={handlers.onSummarize24h}
      >
        {UUMINUTES_MENU_SUMMARIZE_24H}
      </AxoContextMenu.Item>
      <AxoContextMenu.Separator />
      <AxoContextMenu.Item
        symbol="folder"
        onSelect={handlers.onOpenRecordings}
      >
        {UUMINUTES_MENU_OPEN_RECORDINGS}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item symbol="folder" onSelect={handlers.onOpenSummaries}>
        {UUMINUTES_MENU_OPEN_SUMMARIES}
      </AxoContextMenu.Item>
      <AxoContextMenu.Item symbol="info" onSelect={handlers.onShowLog}>
        {UUMINUTES_MENU_SHOW_LOG}
      </AxoContextMenu.Item>
    </>
  );
}
