// Copyright 2026 uuMinutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { ipcRenderer } from 'electron';

import { drop } from '../../util/drop.std.ts';
import { APP_DISPLAY_NAME } from '../branding.std.ts';
import type {
  TranscriptionJob,
  TranscriptionQueueSnapshot,
} from '../transcriptionQueue.std.ts';
import type { TranscriptionProgressPhase } from '../transcriptionProgress.std.ts';
import { subscribeTranscriptionQueue } from '../transcriptionQueueEvents.std.ts';
import {
  closeTranscriptionQueuePanel,
  openTranscriptionQueuePanel,
  transcriptionQueue,
} from '../transcriptionQueueService.preload.ts';
import {
  isCallRecordingFromSelfChat,
  sendCallSummaryToChat,
  sendCallTranscriptToChat,
} from '../sendCallRecordingToChat.preload.ts';
import type { CallRecordingOutput } from '../types.std.ts';
import type { CallRecordingCatalogEntry } from '../recordingsCatalog.std.ts';

type SendAction =
  | 'transcript-chat'
  | 'transcript-self'
  | 'summary-chat'
  | 'summary-self';

function formatClockDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatRecordingDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }

  if (totalMinutes > 0) {
    return `${totalMinutes} min`;
  }

  return formatClockDuration(ms);
}

function formatPhaseLabel(phase?: TranscriptionProgressPhase): string {
  switch (phase) {
    case 'prepare':
      return 'Příprava';
    case 'whisper':
      return 'Whisper';
    case 'ai-correction':
      return 'AI';
    case 'finalize':
      return 'Dokončení';
    default:
      return 'Zpracování';
  }
}

function formatEta(job: TranscriptionJob): string | null {
  if (
    job.status !== 'processing' ||
    job.progress < 3 ||
    job.startedAt == null
  ) {
    return null;
  }

  const elapsed = Date.now() - job.startedAt;
  const remainingMs = (elapsed / job.progress) * (100 - job.progress);
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  return `zbývá cca ${formatRecordingDuration(remainingMs)}`;
}

function formatQueuedPosition(
  job: TranscriptionJob,
  snapshot: TranscriptionQueueSnapshot
): string | null {
  if (job.status !== 'queued') {
    return null;
  }

  const queued = snapshot.jobs.filter(entry => entry.status === 'queued');
  const index = queued.findIndex(entry => entry.id === job.id);
  if (index < 0) {
    return null;
  }

  return `Pozice ve frontě: ${index + 1}/${queued.length}`;
}

function formatProcessingSummary(job: TranscriptionJob): string {
  if (job.kind === 'summary') {
    return `Generování shrnutí · ${job.progress} %`;
  }
  const duration = formatRecordingDuration(job.metadata.durationMs);
  const phase = formatPhaseLabel(job.progressPhase);
  return `Nahrávka ${duration} · ${phase} ${job.progress} %`;
}

function formatQueuedLabel(job: TranscriptionJob): string {
  return job.kind === 'summary' ? 'Čeká ve frontě (shrnutí)' : 'Čeká ve frontě';
}

function findActiveJobForRecording(
  mp3Path: string,
  jobs: ReadonlyArray<TranscriptionJob>
): TranscriptionJob | undefined {
  return jobs.find(
    job =>
      job.metadata.filePath === mp3Path &&
      (job.status === 'queued' ||
        job.status === 'processing' ||
        job.status === 'failed')
  );
}

function ArtifactBadge({
  label,
  ready,
}: Readonly<{ label: string; ready: boolean }>): JSX.Element {
  return (
    <span
      className={`UuMinutesTranscriptionQueue__badge ${
        ready
          ? 'UuMinutesTranscriptionQueue__badge--ready'
          : 'UuMinutesTranscriptionQueue__badge--missing'
      }`}
    >
      {label} {ready ? '✓' : '—'}
    </span>
  );
}

function formatStatus(job: TranscriptionJob, snapshot: TranscriptionQueueSnapshot): string {
  if (job.status === 'processing' && job.cancelRequested) {
    return 'Rušení…';
  }

  switch (job.status) {
    case 'queued':
      return formatQueuedPosition(job, snapshot) ?? formatQueuedLabel(job);
    case 'processing':
      return formatProcessingSummary(job);
    case 'completed':
      return job.kind === 'summary' ? 'Shrnutí hotovo' : 'Hotovo';
    case 'failed':
      return job.error ? `Chyba: ${job.error}` : 'Chyba';
    case 'cancelled':
      return 'Zrušeno';
    default:
      return job.status;
  }
}

function CallOutputSendActions({
  output,
  activeAction,
  isSending,
  onSend,
}: Readonly<{
  output: CallRecordingOutput;
  activeAction: SendAction | null;
  isSending: boolean;
  onSend: (action: SendAction) => void;
}>): JSX.Element {
  const hideSendToSelf = isCallRecordingFromSelfChat(output);
  const hasSummary = Boolean(output.summaryText?.trim());

  return (
    <>
      <div className="UuMinutesTranscriptionQueue__send-group">
        <span className="UuMinutesTranscriptionQueue__send-label">Přepis</span>
        <div className="UuMinutesTranscriptionQueue__send-row">
          <button
            type="button"
            disabled={isSending}
            onClick={() => onSend('transcript-chat')}
          >
            {activeAction === 'transcript-chat'
              ? 'Odesílám…'
              : 'Odeslat do chatu'}
          </button>
          {!hideSendToSelf ? (
            <button
              type="button"
              disabled={isSending}
              onClick={() => onSend('transcript-self')}
            >
              {activeAction === 'transcript-self'
                ? 'Odesílám…'
                : 'Poslat sobě'}
            </button>
          ) : null}
        </div>
      </div>
      {hasSummary ? (
        <div className="UuMinutesTranscriptionQueue__send-group">
          <span className="UuMinutesTranscriptionQueue__send-label">
            Shrnutí
          </span>
          <div className="UuMinutesTranscriptionQueue__send-row">
            <button
              type="button"
              disabled={isSending}
              onClick={() => onSend('summary-chat')}
            >
              {activeAction === 'summary-chat'
                ? 'Odesílám…'
                : 'Odeslat do chatu'}
            </button>
            {!hideSendToSelf ? (
              <button
                type="button"
                disabled={isSending}
                onClick={() => onSend('summary-self')}
              >
                {activeAction === 'summary-self'
                  ? 'Odesílám…'
                  : 'Poslat sobě'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function HistoryRecordingCard({
  entry,
  activeJob,
  onEnqueueTranscription,
  onEnqueueSummary,
  onRefresh,
}: Readonly<{
  entry: CallRecordingCatalogEntry;
  activeJob?: TranscriptionJob;
  onEnqueueTranscription: (entry: CallRecordingCatalogEntry) => void;
  onEnqueueSummary: (entry: CallRecordingCatalogEntry) => void;
  onRefresh: () => void;
}>): JSX.Element {
  const durationLabel =
    entry.durationMs > 0
      ? formatRecordingDuration(entry.durationMs)
      : 'neznámá';

  return (
    <div className="UuMinutesTranscriptionQueue__job UuMinutesTranscriptionQueue__job--history">
      <div className="UuMinutesTranscriptionQueue__job-title">
        {entry.conversationTitle}
      </div>
      <div className="UuMinutesTranscriptionQueue__job-meta">
        Délka: <strong>{durationLabel}</strong>
        {' · '}
        {new Date(entry.endedAt || entry.startedAt).toLocaleString('cs-CZ')}
      </div>
      <div className="UuMinutesTranscriptionQueue__badges">
        <ArtifactBadge label="Přepis" ready={entry.hasTranscript} />
        <ArtifactBadge label="Shrnutí" ready={entry.hasSummary} />
        {!entry.hasPcmSidecar ? (
          <span className="UuMinutesTranscriptionQueue__badge UuMinutesTranscriptionQueue__badge--warn">
            Chybí PCM
          </span>
        ) : null}
      </div>
      {activeJob ? (
        <div
          className={`UuMinutesTranscriptionQueue__job-status UuMinutesTranscriptionQueue__job-status--${activeJob.status}`}
        >
          {activeJob.kind === 'summary' ? 'Shrnutí: ' : ''}
          {formatStatus(activeJob, {
            jobs: [activeJob],
            queuePaused: false,
            activeJobId: activeJob.id,
            panelOpen: true,
          })}
        </div>
      ) : null}
      <div className="UuMinutesTranscriptionQueue__job-actions">
        {!entry.hasTranscript ? (
          <button
            type="button"
            disabled={!entry.hasPcmSidecar || Boolean(activeJob)}
            title={
              entry.hasPcmSidecar
                ? undefined
                : 'Přepis vyžaduje PCM sidecar z nahrávání v této verzi Minutes'
            }
            onClick={() => {
              onEnqueueTranscription(entry);
              onRefresh();
            }}
          >
            Spustit přepis
          </button>
        ) : null}
        {entry.hasTranscript && !entry.hasSummary ? (
          <button
            type="button"
            disabled={Boolean(activeJob)}
            onClick={() => {
              onEnqueueSummary(entry);
              onRefresh();
            }}
          >
            Vygenerovat shrnutí
          </button>
        ) : null}
        {entry.hasTranscript ? (
          <button
            type="button"
            onClick={() => {
              ipcRenderer.send(
                'show-item-in-folder',
                entry.transcriptPath ??
                  entry.mp3Path.replace(/\.mp3$/i, '.transcript.md')
              );
            }}
          >
            Otevřít přepis
          </button>
        ) : null}
        {entry.hasSummary ? (
          <button
            type="button"
            onClick={() => {
              ipcRenderer.send(
                'show-item-in-folder',
                entry.summaryPath ??
                  entry.mp3Path.replace(/\.mp3$/i, '.summary.md')
              );
            }}
          >
            Otevřít shrnutí
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            ipcRenderer.send('show-item-in-folder', entry.mp3Path);
          }}
        >
          Otevřít MP3
        </button>
      </div>
    </div>
  );
}

function TranscriptionQueuePanel({
  snapshot,
  minimized,
  sendingKey,
  showHistory,
  historyEntries,
  historyLoading,
  onShowHistory,
  onRefreshHistory,
  onEnqueueTranscription,
  onEnqueueSummary,
  onSendOutput,
  onMinimize,
  onExpand,
  onClose,
}: Readonly<{
  snapshot: TranscriptionQueueSnapshot;
  minimized: boolean;
  sendingKey: string | null;
  showHistory: boolean;
  historyEntries: ReadonlyArray<CallRecordingCatalogEntry>;
  historyLoading: boolean;
  onShowHistory: (show: boolean) => void;
  onRefreshHistory: () => void;
  onEnqueueTranscription: (entry: CallRecordingCatalogEntry) => void;
  onEnqueueSummary: (entry: CallRecordingCatalogEntry) => void;
  onSendOutput: (job: TranscriptionJob, action: SendAction) => void;
  onMinimize: () => void;
  onExpand: () => void;
  onClose: () => void;
}>): JSX.Element | null {
  const activeCount = useMemo(
    () =>
      snapshot.jobs.filter(
        job => job.status === 'queued' || job.status === 'processing'
      ).length,
    [snapshot.jobs]
  );

  const pillLabel = useMemo(() => {
    const processing = snapshot.jobs.find(job => job.status === 'processing');
    if (processing) {
      const duration = formatRecordingDuration(processing.metadata.durationMs);
      return `Přepis ${processing.progress}% · ${duration}`;
    }
    if (activeCount > 0) {
      return `Fronta ${activeCount}`;
    }
    return 'Přepisy';
  }, [activeCount, snapshot.jobs]);

  if (!snapshot.panelOpen && activeCount === 0) {
    return null;
  }

  if (minimized || !snapshot.panelOpen) {
    return (
      <div
        className="UuMinutesTranscriptionQueue UuMinutesTranscriptionQueue--pill"
        role="button"
        tabIndex={0}
        title="Zobrazit frontu přepisů"
        aria-label="Zobrazit frontu přepisů"
        onClick={onExpand}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            onExpand();
          }
        }}
      >
        <span className="UuMinutesTranscriptionQueue__pill-text">
          {pillLabel}
        </span>
      </div>
    );
  }

  return (
    <div className="UuMinutesTranscriptionQueue">
      <div className="UuMinutesTranscriptionQueue__header">
        <span className="UuMinutesTranscriptionQueue__title">
          Přepisy ({APP_DISPLAY_NAME})
        </span>
        <div className="UuMinutesTranscriptionQueue__header-actions">
          <button type="button" onClick={onMinimize}>
            Skrýt
          </button>
          <button type="button" onClick={onClose}>
            Zavřít
          </button>
        </div>
      </div>

      <div className="UuMinutesTranscriptionQueue__tabs">
        <button
          type="button"
          className={
            !showHistory ? 'UuMinutesTranscriptionQueue__tab--active' : undefined
          }
          onClick={() => onShowHistory(false)}
        >
          Fronta
        </button>
        <button
          type="button"
          className={
            showHistory ? 'UuMinutesTranscriptionQueue__tab--active' : undefined
          }
          onClick={() => onShowHistory(true)}
        >
          Historie nahrávek
        </button>
        {showHistory ? (
          <button
            type="button"
            className="UuMinutesTranscriptionQueue__tab-refresh"
            disabled={historyLoading}
            onClick={onRefreshHistory}
          >
            {historyLoading ? 'Načítám…' : 'Obnovit'}
          </button>
        ) : null}
      </div>

      <div className="UuMinutesTranscriptionQueue__body">
        {showHistory ? (
          historyLoading && historyEntries.length === 0 ? (
            <div className="UuMinutesTranscriptionQueue__empty">
              Načítám historii nahrávek…
            </div>
          ) : historyEntries.length === 0 ? (
            <div className="UuMinutesTranscriptionQueue__empty">
              Zatím žádné uložené nahrávky hovorů.
            </div>
          ) : (
            historyEntries.map(entry => (
              <HistoryRecordingCard
                key={entry.mp3Path}
                entry={entry}
                activeJob={findActiveJobForRecording(entry.mp3Path, snapshot.jobs)}
                onEnqueueTranscription={onEnqueueTranscription}
                onEnqueueSummary={onEnqueueSummary}
                onRefresh={onRefreshHistory}
              />
            ))
          )
        ) : snapshot.jobs.length === 0 ? (
          <div className="UuMinutesTranscriptionQueue__empty">
            Žádné nahrávky ve frontě. Po ukončení hovoru s aktivním rozšířením
            Whisper se přepis zařadí sem a zpracuje na pozadí.
          </div>
        ) : (
          snapshot.jobs.map(job => {
            const eta = formatEta(job);

            return (
              <div key={job.id} className="UuMinutesTranscriptionQueue__job">
                <div className="UuMinutesTranscriptionQueue__job-title">
                  {job.metadata.conversationTitle}
                </div>
                <div className="UuMinutesTranscriptionQueue__job-meta">
                  Délka nahrávky:{' '}
                  <strong>{formatRecordingDuration(job.metadata.durationMs)}</strong>
                  {' · '}
                  {new Date(job.metadata.endedAt).toLocaleString('cs-CZ')}
                </div>
                <div
                  className={`UuMinutesTranscriptionQueue__job-status UuMinutesTranscriptionQueue__job-status--${job.status}`}
                >
                  {formatStatus(job, snapshot)}
                </div>
                {job.status === 'processing' && job.progressDetail ? (
                  <div className="UuMinutesTranscriptionQueue__job-detail">
                    {job.progressDetail}
                  </div>
                ) : null}
                {job.status === 'processing' ? (
                  <>
                    <div className="UuMinutesTranscriptionQueue__progress-row">
                      <span>
                        {job.kind === 'summary' ? 'Shrnutí' : 'Whisper'}{' '}
                        {job.progress} %
                      </span>
                      {eta ? <span>{eta}</span> : null}
                    </div>
                    <div className="UuMinutesTranscriptionQueue__progress">
                      <div
                        className="UuMinutesTranscriptionQueue__progress-bar"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </>
                ) : null}
                <div className="UuMinutesTranscriptionQueue__job-actions">
                  {job.status === 'failed' ? (
                    <button
                      type="button"
                      onClick={() => transcriptionQueue.retryJob(job.id)}
                    >
                      Zkusit znovu
                    </button>
                  ) : null}
                  {job.status === 'queued' || job.status === 'processing' ? (
                    <button
                      type="button"
                      disabled={
                        job.status === 'processing' && Boolean(job.cancelRequested)
                      }
                      onClick={() => transcriptionQueue.cancelJob(job.id)}
                    >
                      {job.status === 'processing' && job.cancelRequested
                        ? 'Rušení…'
                        : 'Zrušit'}
                    </button>
                  ) : null}
                  {job.status === 'completed' ||
                  job.status === 'failed' ||
                  job.status === 'cancelled' ? (
                    <button
                      type="button"
                      onClick={() => transcriptionQueue.removeJob(job.id)}
                    >
                      Odstranit
                    </button>
                  ) : null}
                  {job.status === 'completed' && job.output ? (
                    <CallOutputSendActions
                      output={job.output}
                      activeAction={
                        sendingKey?.startsWith(`${job.id}:`)
                          ? (sendingKey.slice(job.id.length + 1) as SendAction)
                          : null
                      }
                      isSending={sendingKey != null}
                      onSend={action => onSendOutput(job, action)}
                    />
                  ) : null}
                  {job.status === 'completed' ? (
                    <button
                      type="button"
                      onClick={() => {
                        ipcRenderer.send(
                          'show-item-in-folder',
                          job.kind === 'summary'
                            ? job.output?.summaryPath ??
                                job.metadata.filePath.replace(/\.mp3$/i, '.summary.md')
                            : job.output?.transcriptPath ??
                                job.metadata.filePath.replace(/\.mp3$/i, '.transcript.md')
                        );
                      }}
                    >
                      {job.kind === 'summary' ? 'Otevřít shrnutí' : 'Otevřít přepis'}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="UuMinutesTranscriptionQueue__footer">
        {!showHistory && activeCount > 0 ? (
          <button type="button" onClick={() => transcriptionQueue.cancelAllActive()}>
            Zrušit aktivní frontu
          </button>
        ) : null}
        {!showHistory && snapshot.queuePaused ? (
          <button type="button" onClick={() => transcriptionQueue.resumeQueue()}>
            Pokračovat ve frontě
          </button>
        ) : (
          <button type="button" onClick={() => transcriptionQueue.pauseQueue()}>
            Pozastavit frontu
          </button>
        )}
        {!showHistory ? (
          <button type="button" onClick={() => transcriptionQueue.clearCompleted()}>
            Vyčistit hotové
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              ipcRenderer.invoke('uuminutes:open-recordings-folder');
            }}
          >
            Složka nahrávek
          </button>
        )}
      </div>
    </div>
  );
}

export function UuMinutesTranscriptionQueueHost(): JSX.Element | null {
  const [snapshot, setSnapshot] = useState<TranscriptionQueueSnapshot>({
    jobs: [],
    queuePaused: false,
    activeJobId: null,
    panelOpen: false,
  });
  const [minimized, setMinimized] = useState(false);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyEntries, setHistoryEntries] = useState<
    Array<CallRecordingCatalogEntry>
  >([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [, setTick] = useState(0);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const entries = (await ipcRenderer.invoke(
        'uuminutes:list-call-recordings'
      )) as Array<CallRecordingCatalogEntry> | undefined;
      setHistoryEntries(entries ?? []);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => subscribeTranscriptionQueue(setSnapshot), []);

  useEffect(() => {
    if (!showHistory || !snapshot.panelOpen) {
      return;
    }
    drop(loadHistory());
  }, [loadHistory, showHistory, snapshot.panelOpen]);

  useEffect(() => {
    if (!showHistory) {
      return;
    }
    const hasActive = snapshot.jobs.some(
      job => job.status === 'queued' || job.status === 'processing'
    );
    if (!hasActive) {
      drop(loadHistory());
    }
  }, [loadHistory, showHistory, snapshot.jobs]);

  useEffect(() => {
    const hasProcessing = snapshot.jobs.some(job => job.status === 'processing');
    if (!hasProcessing) {
      return;
    }

    const timer = window.setInterval(() => {
      setTick(value => value + 1);
    }, 5_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [snapshot.jobs]);

  useEffect(() => {
    const handler = (): void => {
      openTranscriptionQueuePanel();
      setMinimized(false);
    };
    ipcRenderer.on('uuminutes:open-transcription-queue', handler);
    return () => {
      ipcRenderer.removeListener('uuminutes:open-transcription-queue', handler);
    };
  }, []);

  useEffect(() => {
    if (snapshot.panelOpen) {
      setMinimized(false);
    }
  }, [snapshot.panelOpen]);

  const handleClose = useCallback(() => {
    const hasActive = snapshot.jobs.some(
      job => job.status === 'queued' || job.status === 'processing'
    );
    closeTranscriptionQueuePanel();
    setMinimized(hasActive);
  }, [snapshot.jobs]);

  const handleExpand = useCallback(() => {
    openTranscriptionQueuePanel();
    setMinimized(false);
  }, []);

  const handleEnqueueTranscription = useCallback(
    (entry: CallRecordingCatalogEntry) => {
      transcriptionQueue.enqueueFromCatalog(entry, 'transcription');
      setShowHistory(false);
    },
    []
  );

  const handleEnqueueSummary = useCallback((entry: CallRecordingCatalogEntry) => {
    transcriptionQueue.enqueueFromCatalog(entry, 'summary');
    setShowHistory(false);
  }, []);

  const handleSendOutput = useCallback(
    (job: TranscriptionJob, action: SendAction) => {
      if (!job.output || sendingKey) {
        return;
      }

      const key = `${job.id}:${action}`;
      setSendingKey(key);

      drop(
        (async () => {
          try {
            const output = job.output;
            if (!output) {
              return;
            }

            switch (action) {
              case 'transcript-chat':
                await sendCallTranscriptToChat(output, 'conversation');
                break;
              case 'transcript-self':
                await sendCallTranscriptToChat(output, 'self');
                break;
              case 'summary-chat':
                await sendCallSummaryToChat(output, 'conversation');
                break;
              case 'summary-self':
                await sendCallSummaryToChat(output, 'self');
                break;
              default:
                break;
            }
          } finally {
            setSendingKey(null);
          }
        })()
      );
    },
    [sendingKey]
  );

  const hasVisibleJobs = snapshot.jobs.length > 0 || snapshot.panelOpen;
  if (!hasVisibleJobs) {
    return null;
  }

  return createPortal(
    <TranscriptionQueuePanel
      snapshot={snapshot}
      minimized={minimized}
      sendingKey={sendingKey}
      showHistory={showHistory}
      historyEntries={historyEntries}
      historyLoading={historyLoading}
      onShowHistory={setShowHistory}
      onRefreshHistory={() => {
        drop(loadHistory());
      }}
      onEnqueueTranscription={handleEnqueueTranscription}
      onEnqueueSummary={handleEnqueueSummary}
      onSendOutput={handleSendOutput}
      onMinimize={() => setMinimized(true)}
      onExpand={handleExpand}
      onClose={handleClose}
    />,
    document.body
  );
}
