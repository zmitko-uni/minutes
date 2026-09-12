// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';
import { ipcRenderer } from 'electron';

import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { AxoDropdownMenu } from '../../axo/AxoDropdownMenu.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { toFriendlyError } from '../friendlyError.std.ts';
import { getRecordingArtifactPaths } from '../recordingArtifacts.std.ts';
import type { RecordingListItem } from '../recordingsListModel.std.ts';
import { loadCallRecordingOutputFromEntry } from '../sendCallRecordingToChat.preload.ts';
import { transcriptionQueue } from '../transcriptionQueueService.preload.ts';
import {
  formatEta,
  formatJobStatus,
  formatRecordingDuration,
  formatRecordingWhen,
} from '../transcriptionStatusFormat.std.ts';
import type { TranscriptionJob } from '../transcriptionQueue.std.ts';
import {
  cancelRecordingMp4Export,
  exportRecordingToMp4,
  getRecordingMp4Support,
  installRecordingMp4Support,
  subscribeVideoMp4ExportProgress,
  subscribeVideoMp4SupportProgress,
} from '../videoMp4ExportService.preload.ts';
import { getWhisperModelLabel } from '../whisperSettings.std.ts';
import { MinutesMarkdown } from './MinutesMarkdown.dom.tsx';
import { MinutesRecordingPlayer } from './MinutesRecordingPlayer.dom.tsx';

export type RecordingSendAction =
  | 'transcript-chat'
  | 'transcript-self'
  | 'summary-chat'
  | 'summary-self'
  | 'summary-uubt';

type DetailTab = 'summary' | 'transcript' | 'media';

type Mp4ExportState = Readonly<{
  status: 'running' | 'failed';
  percent: number;
  detail?: string;
  cancellable?: boolean;
  error?: string;
}>;

type RecordingTexts = Readonly<{ transcript: string; summary: string }>;

function ArtifactBadge({
  label,
  ready,
}: Readonly<{ label: string; ready: boolean }>): JSX.Element {
  return (
    <span
      className={`MinutesTranscriptsTab__badge ${
        ready
          ? 'MinutesTranscriptsTab__badge--ready'
          : 'MinutesTranscriptsTab__badge--missing'
      }`}
    >
      {label} {ready ? '✓' : '—'}
    </span>
  );
}

function useMp4Export(
  item: RecordingListItem,
  onRefresh: () => void
): Readonly<{
  state: Mp4ExportState | null;
  start: () => void;
  cancel: () => void;
}> {
  const [state, setState] = useState<Mp4ExportState | null>(null);
  const { recordingPath, durationMs } = item;

  useEffect(() => {
    setState(null);
  }, [recordingPath]);

  useEffect(() => {
    const unsubscribeExport = subscribeVideoMp4ExportProgress(progress => {
      if (progress.recordingPath === recordingPath) {
        setState({
          status: 'running',
          percent: progress.percent,
          detail: 'Převádím video do MP4…',
          cancellable: true,
        });
      }
    });
    const unsubscribeSupport = subscribeVideoMp4SupportProgress(progress => {
      if (progress.recordingPath === recordingPath) {
        setState({
          status: 'running',
          percent: progress.percent,
          detail: progress.detail,
          cancellable: false,
        });
      }
    });
    return () => {
      unsubscribeExport();
      unsubscribeSupport();
    };
  }, [recordingPath]);

  const start = useCallback(() => {
    setState({
      status: 'running',
      percent: 0,
      detail: 'Hledám systémový FFmpeg…',
      cancellable: false,
    });
    drop(
      (async () => {
        try {
          const support = await getRecordingMp4Support();
          if (support.source === 'missing') {
            // oxlint-disable-next-line no-alert
            const accepted = window.confirm(
              `Kompatibilní systémový FFmpeg nebyl nalezen. Stáhnout jednorázově podporu MP4 (${support.downloadLabel ?? 'velikost dle platformy'})?`
            );
            if (!accepted) {
              setState(null);
              return;
            }
            await installRecordingMp4Support(recordingPath);
          }

          setState({
            status: 'running',
            percent: 0,
            detail:
              support.source === 'system'
                ? 'Používám systémový FFmpeg…'
                : 'Převádím video do MP4…',
            cancellable: true,
          });

          await exportRecordingToMp4({ recordingPath, durationMs });
          setState(null);
          onRefresh();
        } catch (error) {
          setState({
            status: 'failed',
            percent: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })()
    );
  }, [durationMs, onRefresh, recordingPath]);

  const cancel = useCallback(() => {
    drop(cancelRecordingMp4Export(recordingPath));
  }, [recordingPath]);

  return { state, start, cancel };
}

/** Přepis i shrnutí se čtou ze souborů, aby detail nezáležel na běžícím jobu. */
function useRecordingTexts(item: RecordingListItem): RecordingTexts | null {
  const [texts, setTexts] = useState<RecordingTexts | null>(null);
  const { entry, job } = item;
  const jobStatus = job?.status;

  useEffect(() => {
    let cancelled = false;
    setTexts(null);

    if (entry == null) {
      setTexts({
        transcript: job?.output?.transcriptText ?? '',
        summary: job?.output?.summaryText ?? '',
      });
      return;
    }

    if (!entry.hasTranscript && !entry.hasSummary) {
      setTexts({ transcript: '', summary: '' });
      return;
    }

    drop(
      (async () => {
        const output = await loadCallRecordingOutputFromEntry(entry);
        if (!cancelled) {
          setTexts({
            transcript: output?.transcriptText ?? '',
            summary: output?.summaryText ?? '',
          });
        }
      })()
    );

    return () => {
      cancelled = true;
    };
    // jobStatus je tu proto, aby se texty načetly znovu po dokončení jobu.
  }, [entry, job?.output, jobStatus]);

  return texts;
}

/** Chybová hláška s doporučením; technický text je schovaný pod odkazem. */
function ErrorNotice({
  title,
  error,
}: Readonly<{ title: string; error: unknown }>): JSX.Element {
  const [showDetail, setShowDetail] = useState(false);
  const friendly = toFriendlyError(error);

  return (
    <div className="MinutesTranscriptsTab__error">
      <p className="MinutesTranscriptsTab__errorTitle">
        {`${title} — ${friendly.title}`}
      </p>
      <p className="MinutesTranscriptsTab__errorMessage">{friendly.message}</p>
      {friendly.detail != null && (
        <button
          type="button"
          className="MinutesTranscriptsTab__errorToggle"
          aria-expanded={showDetail}
          onClick={() => setShowDetail(value => !value)}
        >
          {showDetail ? 'Skrýt podrobnosti' : 'Technické podrobnosti'}
        </button>
      )}
      {showDetail && friendly.detail != null && (
        <pre className="MinutesTranscriptsTab__errorDetail">
          {friendly.detail}
        </pre>
      )}
    </div>
  );
}

function JobProgress({
  job,
  jobs,
}: Readonly<{
  job: TranscriptionJob;
  jobs: ReadonlyArray<TranscriptionJob>;
}>): JSX.Element {
  const eta = formatEta(job);

  if (job.status === 'failed') {
    return (
      <ErrorNotice
        title={job.kind === 'summary' ? 'Shrnutí selhalo' : 'Přepis selhal'}
        error={job.error ?? ''}
      />
    );
  }

  return (
    <div
      className={`MinutesTranscriptsTab__jobStatus MinutesTranscriptsTab__jobStatus--${job.status}`}
    >
      <div className="MinutesTranscriptsTab__jobStatusRow">
        <span>{formatJobStatus(job, jobs)}</span>
        {eta != null && <span>{eta}</span>}
      </div>
      {job.status === 'processing' && (
        <div className="MinutesTranscriptsTab__progress">
          <div
            className="MinutesTranscriptsTab__progressBar"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      )}
      {job.status === 'processing' && job.progressDetail != null && (
        <p className="MinutesTranscriptsTab__jobDetail">{job.progressDetail}</p>
      )}
    </div>
  );
}

function SummaryPane({
  texts,
  hasTranscript,
}: Readonly<{
  texts: RecordingTexts | null;
  hasTranscript: boolean;
}>): JSX.Element {
  if (texts == null) {
    return <p className="MinutesTranscriptsTab__note">Načítám shrnutí…</p>;
  }
  if (texts.summary.length > 0) {
    return <MinutesMarkdown source={texts.summary} />;
  }
  return (
    <p className="MinutesTranscriptsTab__note">
      {hasTranscript
        ? 'Shrnutí zatím není. Vygenerujte ho tlačítkem nahoře — použije se aktuální styl z Nastavení AI.'
        : 'Shrnutí vzniká z přepisu. Nejdřív nahrávku přepište.'}
    </p>
  );
}

function TranscriptPane({
  texts,
  canTranscribe,
}: Readonly<{
  texts: RecordingTexts | null;
  canTranscribe: boolean;
}>): JSX.Element {
  if (texts == null) {
    return <p className="MinutesTranscriptsTab__note">Načítám přepis…</p>;
  }
  if (texts.transcript.length > 0) {
    return (
      <pre className="MinutesTranscriptsTab__transcript">
        {texts.transcript}
      </pre>
    );
  }
  return (
    <p className="MinutesTranscriptsTab__note">
      {canTranscribe
        ? 'Přepis zatím není. Spusťte ho tlačítkem nahoře.'
        : 'K nahrávce chybí PCM sidecar, takže ji tato verze Minutes neumí přepsat.'}
    </p>
  );
}

export function MinutesRecordingDetail({
  item,
  jobs,
  sendingKey,
  activeWhisperModelLabel,
  isSelfChat,
  onEnqueueTranscription,
  onEnqueueSummary,
  onSend,
  onRefresh,
}: Readonly<{
  item: RecordingListItem;
  jobs: ReadonlyArray<TranscriptionJob>;
  sendingKey: string | null;
  activeWhisperModelLabel: string;
  isSelfChat: boolean;
  onEnqueueTranscription: (item: RecordingListItem) => void;
  onEnqueueSummary: (item: RecordingListItem) => void;
  onSend: (item: RecordingListItem, action: RecordingSendAction) => void;
  onRefresh: () => void;
}>): JSX.Element {
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const texts = useRecordingTexts(item);
  const mp4 = useMp4Export(item, onRefresh);

  const { entry, job } = item;
  const mp4Path = entry?.mp4Path ?? null;
  const artifacts = getRecordingArtifactPaths(item.recordingPath);
  const isBusy =
    job != null && (job.status === 'queued' || job.status === 'processing');
  const isSending = sendingKey != null;
  const canTranscribe = entry?.hasPcmSidecar ?? false;
  const isVideo = item.mediaKind === 'screen-share-video';
  const usedModelLabel =
    entry?.transcriptWhisperModelLabel ??
    (entry?.transcriptWhisperModelFileName != null
      ? getWhisperModelLabel(entry.transcriptWhisperModelFileName)
      : null);

  // Nahrávka bez přepisu nemá co ukazovat ve výchozím tabu.
  useEffect(() => {
    setActiveTab(item.hasSummary ? 'summary' : 'transcript');
  }, [item.recordingPath, item.hasSummary]);

  const openInFolder = useCallback((path: string) => {
    ipcRenderer.send('show-item-in-folder', path);
  }, []);

  return (
    <div className="MinutesTranscriptsTab__detail">
      <header className="MinutesTranscriptsTab__detailHeader">
        <h2 className="MinutesTranscriptsTab__detailTitle">
          {item.conversationTitle}
        </h2>
        <p className="MinutesTranscriptsTab__detailMeta">
          {formatRecordingWhen(item.startedAt)}
          {' · '}
          {item.durationMs > 0
            ? formatRecordingDuration(item.durationMs)
            : 'délka neznámá'}
          {' · '}
          {isVideo ? 'Video' : 'Audio'}
          {usedModelLabel != null ? ` · Whisper ${usedModelLabel}` : ''}
        </p>

        <div className="MinutesTranscriptsTab__badges">
          <ArtifactBadge label="Přepis" ready={item.hasTranscript} />
          <ArtifactBadge label="Shrnutí" ready={item.hasSummary} />
          {isVideo && (
            <ArtifactBadge label="MP4" ready={entry?.hasMp4Export ?? false} />
          )}
          {entry != null && !entry.hasPcmSidecar && (
            <span className="MinutesTranscriptsTab__badge MinutesTranscriptsTab__badge--warn">
              Chybí PCM
            </span>
          )}
        </div>

        <div className="MinutesTranscriptsTab__actions">
          {!item.hasTranscript ? (
            <AxoButton.Root
              variant="strong-primary"
              size="sm"
              disabled={isBusy || !canTranscribe}
              onClick={() => onEnqueueTranscription(item)}
            >
              Spustit přepis
            </AxoButton.Root>
          ) : (
            <AxoButton.Root
              variant={item.hasSummary ? 'subtle-primary' : 'strong-primary'}
              size="sm"
              disabled={isBusy}
              onClick={() => onEnqueueSummary(item)}
            >
              {item.hasSummary ? 'Přegenerovat shrnutí' : 'Vygenerovat shrnutí'}
            </AxoButton.Root>
          )}

          {item.hasTranscript && (
            <AxoButton.Root
              variant="subtle-primary"
              size="sm"
              disabled={isBusy || !canTranscribe}
              onClick={() => onEnqueueTranscription(item)}
            >
              {`Přepsat znovu (${activeWhisperModelLabel})`}
            </AxoButton.Root>
          )}

          <AxoDropdownMenu.Root>
            <AxoDropdownMenu.Trigger>
              <AxoButton.Root
                variant="subtle-primary"
                size="sm"
                disabled={
                  (!item.hasTranscript && !item.hasSummary) || isSending
                }
              >
                {isSending ? 'Odesílám…' : 'Sdílet'}
              </AxoButton.Root>
            </AxoDropdownMenu.Trigger>
            <AxoDropdownMenu.Content>
              {item.hasTranscript && (
                <AxoDropdownMenu.Item
                  onSelect={() => onSend(item, 'transcript-chat')}
                >
                  Přepis do chatu
                </AxoDropdownMenu.Item>
              )}
              {item.hasTranscript && !isSelfChat && (
                <AxoDropdownMenu.Item
                  onSelect={() => onSend(item, 'transcript-self')}
                >
                  Přepis sobě
                </AxoDropdownMenu.Item>
              )}
              {item.hasSummary && (
                <AxoDropdownMenu.Item
                  onSelect={() => onSend(item, 'summary-chat')}
                >
                  Shrnutí do chatu
                </AxoDropdownMenu.Item>
              )}
              {item.hasSummary && !isSelfChat && (
                <AxoDropdownMenu.Item
                  onSelect={() => onSend(item, 'summary-self')}
                >
                  Shrnutí sobě
                </AxoDropdownMenu.Item>
              )}
              {item.hasSummary && (
                <>
                  <AxoDropdownMenu.Separator />
                  <AxoDropdownMenu.Item
                    onSelect={() => onSend(item, 'summary-uubt')}
                  >
                    Zápis do schůzky v uuBT
                  </AxoDropdownMenu.Item>
                </>
              )}
            </AxoDropdownMenu.Content>
          </AxoDropdownMenu.Root>

          <AxoDropdownMenu.Root>
            <AxoDropdownMenu.Trigger>
              <AxoButton.Root variant="subtle-primary" size="sm">
                Soubory
              </AxoButton.Root>
            </AxoDropdownMenu.Trigger>
            <AxoDropdownMenu.Content>
              <AxoDropdownMenu.Item
                onSelect={() => openInFolder(item.recordingPath)}
              >
                {isVideo ? 'Otevřít WebM' : 'Otevřít MP3'}
              </AxoDropdownMenu.Item>
              {item.hasTranscript && (
                <AxoDropdownMenu.Item
                  onSelect={() =>
                    openInFolder(
                      entry?.transcriptPath ?? artifacts.transcriptPath
                    )
                  }
                >
                  Otevřít přepis
                </AxoDropdownMenu.Item>
              )}
              {item.hasSummary && (
                <AxoDropdownMenu.Item
                  onSelect={() =>
                    openInFolder(entry?.summaryPath ?? artifacts.summaryPath)
                  }
                >
                  Otevřít shrnutí
                </AxoDropdownMenu.Item>
              )}
              {mp4Path != null && (
                <AxoDropdownMenu.Item onSelect={() => openInFolder(mp4Path)}>
                  Otevřít MP4
                </AxoDropdownMenu.Item>
              )}
              {isVideo && mp4.state?.status !== 'running' && (
                <AxoDropdownMenu.Item onSelect={mp4.start}>
                  {entry?.hasMp4Export ? 'Přegenerovat MP4' : 'Vytvořit MP4'}
                </AxoDropdownMenu.Item>
              )}
              {isVideo && mp4.state?.cancellable === true && (
                <AxoDropdownMenu.Item onSelect={mp4.cancel}>
                  Zrušit převod MP4
                </AxoDropdownMenu.Item>
              )}
              <AxoDropdownMenu.Separator />
              <AxoDropdownMenu.Item
                onSelect={() => {
                  drop(ipcRenderer.invoke('minutes:open-recordings-folder'));
                }}
              >
                Složka nahrávek
              </AxoDropdownMenu.Item>
            </AxoDropdownMenu.Content>
          </AxoDropdownMenu.Root>

          {job != null && isBusy && (
            <AxoButton.Root
              variant="subtle-primary"
              size="sm"
              disabled={job.status === 'processing' && job.cancelRequested}
              onClick={() => transcriptionQueue.cancelJob(job.id)}
            >
              {job.status === 'processing' && job.cancelRequested
                ? 'Rušení…'
                : 'Zrušit'}
            </AxoButton.Root>
          )}

          {job?.status === 'failed' && (
            <AxoButton.Root
              variant="subtle-primary"
              size="sm"
              onClick={() => transcriptionQueue.retryJob(job.id)}
            >
              Zkusit znovu
            </AxoButton.Root>
          )}
        </div>

        {job != null && job.status !== 'completed' && (
          <JobProgress job={job} jobs={jobs} />
        )}

        {mp4.state?.status === 'failed' && (
          <ErrorNotice
            title="Převod do MP4 selhal"
            error={mp4.state.error ?? ''}
          />
        )}

        {mp4.state?.status === 'running' && (
          <div className="MinutesTranscriptsTab__jobStatus MinutesTranscriptsTab__jobStatus--processing">
            <div className="MinutesTranscriptsTab__jobStatusRow">
              <span>
                {`${mp4.state.detail ?? 'Převod do MP4'} ${mp4.state.percent} %`}
              </span>
            </div>
            <div className="MinutesTranscriptsTab__progress">
              <div
                className="MinutesTranscriptsTab__progressBar"
                style={{ width: `${mp4.state.percent}%` }}
              />
            </div>
          </div>
        )}

        <div
          className="MinutesTranscriptsTab__detailTabs"
          role="tablist"
          aria-label="Obsah nahrávky"
        >
          {(
            [
              ['summary', 'Shrnutí'],
              ['transcript', 'Přepis'],
              ['media', isVideo ? 'Video' : 'Nahrávka'],
            ] as ReadonlyArray<readonly [DetailTab, string]>
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={activeTab === value}
              className="MinutesTranscriptsTab__detailTab"
              onClick={() => setActiveTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="MinutesTranscriptsTab__detailBody">
        {activeTab === 'media' && <MinutesRecordingPlayer item={item} />}
        {activeTab === 'summary' && (
          <SummaryPane texts={texts} hasTranscript={item.hasTranscript} />
        )}
        {activeTab === 'transcript' && (
          <TranscriptPane texts={texts} canTranscribe={canTranscribe} />
        )}
      </div>
    </div>
  );
}
