// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { ipcRenderer } from 'electron';

import { drop } from '../../util/drop.std.ts';
import type { ChatSummaryResult } from '../types.std.ts';
import {
  subscribeSummaryUi,
  summaryUi,
  type SummaryUiState,
} from '../summaryUiEvents.std.ts';
import { APP_DISPLAY_NAME } from '../branding.std.ts';
import type { CallRecordingOutput } from '../types.std.ts';
import {
  isCallRecordingFromSelfChat,
  sendCallSummaryToChat,
  sendCallTranscriptToChat,
} from '../sendCallRecordingToChat.preload.ts';
import {
  isSummaryFromSelfChat,
  sendSummaryToChat,
  sendSummaryToSelf,
} from '../sendSummaryToChat.preload.ts';
import { openMinutesLog } from '../navigation.preload.ts';

const TOAST_TIMEOUT_MS = 25_000;

function isCallTranscriptResult(result: ChatSummaryResult): boolean {
  return result.filePath.includes('.transcript.');
}

function toCallRecordingOutput(result: ChatSummaryResult): CallRecordingOutput {
  return {
    conversationId: result.conversationId,
    conversationTitle: result.conversationTitle,
    transcriptPath: result.filePath,
    transcriptText: result.transcriptText?.trim() ?? result.summaryText.trim(),
    summaryText: result.aiSummary?.trim(),
  };
}

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
  onSendCall,
  onShowFile,
}: Readonly<{
  state: SummaryUiState;
  isSending: boolean;
  onClose: () => void;
  onSendToChat: (result: ChatSummaryResult) => void;
  onSendToSelf: (result: ChatSummaryResult) => void;
  onSendCall: (
    output: CallRecordingOutput,
    kind: 'transcript' | 'summary',
    target: 'conversation' | 'self'
  ) => void;
  onShowFile: (result: ChatSummaryResult) => void;
}>): JSX.Element {
  if (state.kind === 'working') {
    return (
      <div className="MinutesActivityBanner MinutesActivityBanner--working">
        <span>{state.message}</span>
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="MinutesActivityBanner MinutesActivityBanner--error">
        <span className="MinutesActivityBanner__text">{state.message}</span>
        <div className="MinutesActivityBanner__actions">
          <button type="button" onClick={openMinutesLog}>
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
    const result = state.result;
    const isCallTranscript = isCallTranscriptResult(result);
    const callOutput = isCallTranscript ? toCallRecordingOutput(result) : null;
    const hideSendToSelf = isCallTranscript
      ? isCallRecordingFromSelfChat(callOutput!)
      : isSummaryFromSelfChat(result);
    const hasCallSummary = Boolean(callOutput?.summaryText?.trim());

    return (
      <div className="MinutesActivityBanner MinutesActivityBanner--saved">
        <span className="MinutesActivityBanner__text">
          {formatSavedBannerMessage(result)}
        </span>
        <div className="MinutesActivityBanner__actions">
          {isCallTranscript && callOutput ? (
            <>
              <button
                type="button"
                disabled={isSending}
                onClick={() => onSendCall(callOutput, 'transcript', 'conversation')}
              >
                {isSending ? 'Odesílám…' : 'Odeslat přepis do chatu'}
              </button>
              {!hideSendToSelf ? (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => onSendCall(callOutput, 'transcript', 'self')}
                >
                  {isSending ? 'Odesílám…' : 'Přepis sobě'}
                </button>
              ) : null}
              {hasCallSummary ? (
                <>
                  <button
                    type="button"
                    disabled={isSending}
                    onClick={() => onSendCall(callOutput, 'summary', 'conversation')}
                  >
                    {isSending ? 'Odesílám…' : 'Odeslat shrnutí do chatu'}
                  </button>
                  {!hideSendToSelf ? (
                    <button
                      type="button"
                      disabled={isSending}
                      onClick={() => onSendCall(callOutput, 'summary', 'self')}
                    >
                      {isSending ? 'Odesílám…' : 'Shrnutí sobě'}
                    </button>
                  ) : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isSending}
                onClick={() => onSendToChat(result)}
              >
                {isSending ? 'Odesílám…' : 'Odeslat do chatu'}
              </button>
              {!hideSendToSelf ? (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => onSendToSelf(result)}
                >
                  {isSending ? 'Odesílám…' : 'Poslat sobě'}
                </button>
              ) : null}
            </>
          )}
          <button
            type="button"
            disabled={isSending}
            onClick={() => onShowFile(result)}
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

export function MinutesSummaryToastHost(): JSX.Element | null {
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

  const handleSendCall = useCallback(
    (
      output: CallRecordingOutput,
      kind: 'transcript' | 'summary',
      target: 'conversation' | 'self'
    ) => {
      if (isSending) {
        return;
      }
      setIsSending(true);
      drop(
        (async () => {
          const sent =
            kind === 'transcript'
              ? await sendCallTranscriptToChat(output, target)
              : await sendCallSummaryToChat(output, target);
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
      onSendCall={handleSendCall}
      onShowFile={handleShowFile}
    />,
    document.body
  );
}
