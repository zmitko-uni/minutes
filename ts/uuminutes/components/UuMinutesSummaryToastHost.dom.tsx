// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { ipcRenderer } from 'electron';

import { drop } from '../../util/drop.std.ts';
import type { ChatSummaryResult } from '../types.std.ts';
import { APP_DISPLAY_NAME } from '../branding.std.ts';
import {
  subscribeSummaryUi,
  summaryUi,
  type SummaryUiState,
} from '../summaryUiEvents.std.ts';
import {
  isSummaryFromSelfChat,
  sendSummaryToChat,
  sendSummaryToSelf,
} from '../sendSummaryToChat.preload.ts';
import { openUuMinutesLog } from '../navigation.preload.ts';

const TOAST_TIMEOUT_MS = 25_000;

function formatSavedBannerMessage(result: ChatSummaryResult): string {
  const isTranscript = result.filePath.includes('.transcript.');
  if (isTranscript) {
    return 'Přepis hovoru uložen';
  }

  const countLabel = `${result.messageCount} zpráv`;

  if (result.aiSummary) {
    return `Shrnutí uloženo (${countLabel}) včetně AI shrnutí`;
  }

  if (result.aiSkippedReason === 'no_key') {
    return `Přepis konverzace uložen (${countLabel}). Není nastaven AI klíč — v menu ${APP_DISPLAY_NAME} → Nastavení AI… můžete doplnit klíč pro AI shrnutí.`;
  }

  if (result.aiSkippedReason === 'disabled') {
    return `Přepis konverzace uložen (${countLabel}). AI shrnutí je vypnuté — zapněte ho v menu ${APP_DISPLAY_NAME} → Nastavení AI…`;
  }

  if (result.aiError) {
    return `Přepis konverzace uložen (${countLabel}). AI shrnutí se nepovedlo: ${result.aiError}`;
  }

  return `Shrnutí uloženo (${countLabel})`;
}

function ActivityBanner({
  state,
  isSending,
  onClose,
  onSendToChat,
  onSendToSelf,
  onShowFile,
}: Readonly<{
  state: SummaryUiState;
  isSending: boolean;
  onClose: () => void;
  onSendToChat: (result: ChatSummaryResult) => void;
  onSendToSelf: (result: ChatSummaryResult) => void;
  onShowFile: (result: ChatSummaryResult) => void;
}>): JSX.Element {
  if (state.kind === 'working') {
    return (
      <div className="UuMinutesActivityBanner UuMinutesActivityBanner--working">
        <span>{state.message}</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="UuMinutesActivityBanner UuMinutesActivityBanner--error">
        <span className="UuMinutesActivityBanner__text">{state.message}</span>
        <div className="UuMinutesActivityBanner__actions">
          <button type="button" onClick={openUuMinutesLog}>
            Show log
          </button>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'saved') {
    const hideSendToSelf = isSummaryFromSelfChat(state.result);
    return (
      <div className="UuMinutesActivityBanner UuMinutesActivityBanner--saved">
        <span className="UuMinutesActivityBanner__text">
          {formatSavedBannerMessage(state.result)}
        </span>
        <div className="UuMinutesActivityBanner__actions">
          <button
            type="button"
            disabled={isSending}
            onClick={() => onSendToChat(state.result)}
          >
            {isSending ? 'Odesílám…' : 'Odeslat do chatu'}
          </button>
          {!hideSendToSelf && (
            <button
              type="button"
              disabled={isSending}
              onClick={() => onSendToSelf(state.result)}
            >
              {isSending ? 'Odesílám…' : 'Poslat sobě'}
            </button>
          )}
          <button
            type="button"
            disabled={isSending}
            onClick={() => onShowFile(state.result)}
          >
            Zobrazit soubor
          </button>
          <button type="button" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>
    );
  }

  return <></>;
}

export function UuMinutesSummaryToastHost(): JSX.Element | null {
  const [state, setState] = useState<SummaryUiState>({ kind: 'idle' });
  const [isSending, setIsSending] = useState(false);

  useEffect(() => subscribeSummaryUi(setState), []);

  useEffect(() => {
    if (state.kind === 'idle' || state.kind === 'working' || isSending) {
      return;
    }

    const timeoutId = setTimeout(() => {
      summaryUi.hide();
    }, TOAST_TIMEOUT_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isSending, state]);

  const handleClose = useCallback(() => {
    summaryUi.hide();
    setIsSending(false);
  }, []);

  const handleShowFile = useCallback(
    (result: ChatSummaryResult) => {
      ipcRenderer.send('show-item-in-folder', result.filePath);
      handleClose();
    },
    [handleClose]
  );

  const handleSend = useCallback(
    (send: (result: ChatSummaryResult) => Promise<boolean>) =>
      (result: ChatSummaryResult) => {
        if (isSending) {
          return;
        }
        setIsSending(true);
        drop(
          (async () => {
            const sent = await send(result);
            if (sent) {
              handleClose();
            } else {
              setIsSending(false);
            }
          })()
        );
      },
    [handleClose, isSending]
  );

  const handleSendToChat = useCallback(
    (result: ChatSummaryResult) => handleSend(sendSummaryToChat)(result),
    [handleSend]
  );

  const handleSendToSelf = useCallback(
    (result: ChatSummaryResult) => handleSend(sendSummaryToSelf)(result),
    [handleSend]
  );

  if (state.kind === 'idle') {
    return null;
  }

  return createPortal(
    <ActivityBanner
      state={state}
      isSending={isSending}
      onClose={handleClose}
      onSendToChat={handleSendToChat}
      onSendToSelf={handleSendToSelf}
      onShowFile={handleShowFile}
    />,
    document.body
  );
}
