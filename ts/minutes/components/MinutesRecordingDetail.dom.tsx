// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { ipcRenderer } from 'electron';

import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { AxoDialog } from '../../axo/AxoDialog.dom.tsx';
import { AxoDropdownMenu } from '../../axo/AxoDropdownMenu.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import {
  AI_SUMMARY_STYLE_OPTIONS,
  type AiProvider,
  type AiSettingsPublic,
  type AiSummaryStyle,
} from '../aiSettings.std.ts';
import { buildConfiguredAiModelChoices } from '../aiModelChoices.std.ts';
import { getAiSettings } from '../aiSettingsService.preload.ts';
import { getCallSummaryExtensionState } from '../callSummaryExtensionService.preload.ts';
import { callSummaryExtensionEvents } from '../callSummaryExtensionEvents.std.ts';
import { toFriendlyError } from '../friendlyError.std.ts';
import { getRecordingArtifactPaths } from '../recordingArtifacts.std.ts';
import type { RecordingMeetingLink } from '../recordingMeeting.std.ts';
import { saveRecordingSummary } from '../recordingFilesService.preload.ts';
import type { RecordingListItem } from '../recordingsListModel.std.ts';
import type { RecordingTextHit } from '../recordingsSearch.std.ts';
import { loadCallRecordingOutputFromEntry } from '../sendCallRecordingToChat.preload.ts';
import { transcriptionQueue } from '../transcriptionQueueService.preload.ts';
import {
  formatEta,
  formatJobStatus,
  formatRecordingDuration,
  formatRecordingWhen,
} from '../transcriptionStatusFormat.std.ts';
import type {
  TranscriptionJob,
  TranscriptionJobOptions,
} from '../transcriptionQueue.std.ts';
import {
  cancelRecordingMp4Export,
  exportRecordingToMp4,
  getRecordingMp4Support,
  installRecordingMp4Support,
  subscribeVideoMp4ExportProgress,
  subscribeVideoMp4SupportProgress,
} from '../videoMp4ExportService.preload.ts';
import { getWhisperModelLabel } from '../whisperSettings.std.ts';
import {
  MinutesIconButton,
  MinutesOptionsPopover,
} from './MinutesIconButton.dom.tsx';
import { MinutesIcon } from './MinutesIcon.dom.tsx';
import { MinutesMarkdown } from './MinutesMarkdown.dom.tsx';
import { MinutesRecordingMeetingPane } from './MinutesRecordingMeetingPane.dom.tsx';
import { MinutesRecordingPlayer } from './MinutesRecordingPlayer.dom.tsx';
import { MinutesSummaryEditor } from './MinutesSummaryEditor.dom.tsx';
import { MinutesTranscriptView } from './MinutesTranscriptView.dom.tsx';
import type { MinutesTextHighlight } from './MinutesTextHighlight.dom.tsx';
import {
  listTranscriptSpeakers,
  parseTranscriptSegments,
} from '../transcriptDisplay.std.ts';
import {
  UUBT_ACTIVITY_STATE_SOLVED,
  isUubtMeetingSolvableByMe,
} from '../uubt.std.ts';
import { markUubtMeetingSolved } from '../uubtService.preload.ts';

export type RecordingSendAction =
  | 'transcript-chat'
  | 'transcript-self'
  | 'summary-chat'
  | 'summary-self';

type DetailTab = 'summary' | 'transcript' | 'media' | 'meeting';

const NO_WHISPER_MODEL_HINT =
  'Není stažený žádný model přepisu. Přidejte ho v Minutes → Nastavení přepisů…';

function formatTranscribeModelLabel(
  selected: string | null,
  active: string | null
): string {
  const fileName = selected ?? active;
  if (fileName == null) {
    return 'aktivní model';
  }
  return getWhisperModelLabel(fileName);
}

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

/**
 * Sdílení patří k obsahu tabu, ne k celé nahrávce — v tabu Shrnutí nabízí
 * shrnutí, v tabu Přepis přepis, a u obou volbu do chatu nebo sobě.
 */
function SharePanel({
  kind,
  item,
  isSelfChat,
  isSending,
  onSend,
}: Readonly<{
  kind: 'summary' | 'transcript';
  item: RecordingListItem;
  isSelfChat: boolean;
  isSending: boolean;
  onSend: (item: RecordingListItem, action: RecordingSendAction) => void;
}>): JSX.Element {
  const isReady = kind === 'summary' ? item.hasSummary : item.hasTranscript;
  const what = kind === 'summary' ? 'shrnutí' : 'přepis';

  return (
    <MinutesOptionsPopover
      icon="share"
      label={isSending ? 'Odesílám…' : `Sdílet ${what}`}
      disabled={!isReady || isSending}
    >
      {close => (
        <div className="MinutesOptionsPopover__actions">
          <AxoButton.Root
            variant="subtle-primary"
            size="sm"
            width="full"
            onClick={() => {
              close();
              onSend(item, `${kind}-chat`);
            }}
          >
            Do chatu
          </AxoButton.Root>

          {!isSelfChat && (
            <AxoButton.Root
              variant="subtle-primary"
              size="sm"
              width="full"
              onClick={() => {
                close();
                onSend(item, `${kind}-self`);
              }}
            >
              Sobě
            </AxoButton.Root>
          )}

          <p className="MinutesOptionsPopover__hint">
            {isSelfChat
              ? `Odešle ${what} jako zprávu do tohoto chatu.`
              : `Do chatu = ${item.conversationTitle}. Sobě = vaše poznámky.`}
          </p>
        </div>
      )}
    </MinutesOptionsPopover>
  );
}

/**
 * Zápis ke schůzce vzniká z AI shrnutí, takže bez shrnutí a bez zapnuté
 * Plus4U integrace není co poslat — tlačítko pak v tooltipu řekne, co chybí.
 */
function WriteToMeetingButton({
  label,
  hint,
  isEnabled,
  onClick,
}: Readonly<{
  label: string;
  hint: string;
  isEnabled: boolean;
  onClick: () => void;
}>): JSX.Element {
  return (
    <span
      className="MinutesTranscriptsTab__hintWrap"
      title={isEnabled ? undefined : hint}
    >
      <AxoButton.Root
        variant="subtle-primary"
        size="sm"
        disabled={!isEnabled}
        onClick={onClick}
      >
        {label}
      </AxoButton.Root>
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

/** Whisper modely, které jsou reálně stažené — jen z nich jde vybírat. */
function useInstalledWhisperModels(): Readonly<{
  models: ReadonlyArray<Readonly<{ fileName: string; label: string }>>;
  activeFileName: string | null;
}> {
  const [state, setState] = useState(() => getCallSummaryExtensionState());

  useEffect(() => {
    setState(getCallSummaryExtensionState());
    return callSummaryExtensionEvents.on(setState);
  }, []);

  return useMemo(
    () => ({
      models: state.availableModels
        .filter(model => model.installed && model.ready)
        .map(model => ({ fileName: model.fileName, label: model.label })),
      activeFileName: state.modelFileName,
    }),
    [state]
  );
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

function DeleteConfirmDialog({
  item,
  onConfirm,
  onCancel,
}: Readonly<{
  item: RecordingListItem;
  onConfirm: () => void;
  onCancel: () => void;
}>): JSX.Element {
  return (
    <AxoDialog.Root
      open
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          onCancel();
        }
      }}
    >
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>Smazat nahrávku?</AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Body>
          <AxoDialog.Description>
            <p className={tw('text-label-medium')}>
              Smaže se záznam &bdquo;{item.conversationTitle}&ldquo; včetně
              zvuku nebo videa, přepisu, shrnutí, MP4 i metadat. Tuhle akci
              nelze vzít zpět.
            </p>
          </AxoDialog.Description>
        </AxoDialog.Body>
        <AxoDialog.Footer>
          <AxoDialog.Actions>
            <AxoDialog.Action variant="subtle-secondary" onClick={onCancel}>
              Ponechat
            </AxoDialog.Action>
            <AxoDialog.Action variant="strong-destructive" onClick={onConfirm}>
              Smazat vše
            </AxoDialog.Action>
          </AxoDialog.Actions>
        </AxoDialog.Footer>
      </AxoDialog.Content>
    </AxoDialog.Root>
  );
}

function SummaryOptionsPanel({
  aiSettings,
  provider,
  model,
  style,
  onProviderModelChange,
  onStyleChange,
}: Readonly<{
  aiSettings: AiSettingsPublic | null;
  provider: AiProvider | null;
  model: string | null;
  style: AiSummaryStyle | null;
  onProviderModelChange: (
    provider: AiProvider | null,
    model: string | null
  ) => void;
  onStyleChange: (style: AiSummaryStyle | null) => void;
}>): JSX.Element {
  const choices = useMemo(
    () => (aiSettings != null ? buildConfiguredAiModelChoices(aiSettings) : []),
    [aiSettings]
  );

  return (
    <div className="MinutesOptionsPopover__form">
      <label className="MinutesOptionsPopover__field">
        <span>Model</span>
        <select
          value={
            provider != null && model != null ? `${provider}::${model}` : ''
          }
          onChange={event => {
            const [nextProvider, nextModel] = event.target.value.split('::');
            onProviderModelChange(
              (nextProvider as AiProvider | undefined) ?? null,
              nextModel ?? null
            );
          }}
        >
          {choices.map(choice => (
            <option
              key={`${choice.provider}::${choice.model}`}
              value={`${choice.provider}::${choice.model}`}
            >
              {choice.label}
            </option>
          ))}
        </select>
      </label>

      <label className="MinutesOptionsPopover__field">
        <span>Styl</span>
        <select
          value={style ?? ''}
          onChange={event =>
            onStyleChange(
              event.target.value === ''
                ? null
                : (event.target.value as AiSummaryStyle)
            )
          }
        >
          {AI_SUMMARY_STYLE_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <p className="MinutesOptionsPopover__hint">
        Předvyplněno z Nastavení AI. Změna platí jen pro tohle přegenerování,
        nastavení nepřepíše. Instrukce pro styl Vlastní se berou z Nastavení AI.
      </p>
    </div>
  );
}

function WhisperModelPanel({
  models,
  activeFileName,
  selected,
  onSelect,
}: Readonly<{
  models: ReadonlyArray<Readonly<{ fileName: string; label: string }>>;
  activeFileName: string | null;
  selected: string | null;
  onSelect: (fileName: string | null) => void;
}>): JSX.Element {
  return (
    <div className="MinutesOptionsPopover__form">
      <label className="MinutesOptionsPopover__field">
        <span>Model přepisu</span>
        <select
          value={selected ?? ''}
          onChange={event =>
            onSelect(event.target.value === '' ? null : event.target.value)
          }
        >
          <option value="">
            {activeFileName != null
              ? `Aktivní model (${getWhisperModelLabel(activeFileName)})`
              : 'Aktivní model'}
          </option>
          {models.map(model => (
            <option key={model.fileName} value={model.fileName}>
              {model.label}
            </option>
          ))}
        </select>
      </label>
      <p className="MinutesOptionsPopover__hint">
        Vybírat lze jen ze stažených modelů. Další se stahují v Nastavení
        přepisů.
      </p>
    </div>
  );
}

export function MinutesRecordingDetail({
  item,
  jobs,
  sendingKey,
  isSelfChat,
  isUubtEnabled,
  meetingLink,
  searchQuery,
  searchHit,
  onEnqueueTranscription,
  onEnqueueSummary,
  onSend,
  onWriteToMeeting,
  onDelete,
  onMeetingLinkChange,
  onRefresh,
}: Readonly<{
  item: RecordingListItem;
  jobs: ReadonlyArray<TranscriptionJob>;
  sendingKey: string | null;
  isSelfChat: boolean;
  isUubtEnabled: boolean;
  meetingLink: RecordingMeetingLink | null;
  /** Hledaný text — zvýrazní se ve shrnutí i v přepisu. */
  searchQuery: string;
  /** Nález, na který uživatel klikl v seznamu; přepne tab a doskroluje. */
  searchHit: RecordingTextHit | null;
  onEnqueueTranscription: (
    item: RecordingListItem,
    options?: TranscriptionJobOptions
  ) => void;
  onEnqueueSummary: (
    item: RecordingListItem,
    options?: TranscriptionJobOptions
  ) => void;
  onSend: (item: RecordingListItem, action: RecordingSendAction) => void;
  onWriteToMeeting: (item: RecordingListItem) => void;
  onDelete: (item: RecordingListItem) => void;
  onMeetingLinkChange: (link: RecordingMeetingLink) => void;
  onRefresh: () => void;
}>): JSX.Element {
  const [activeTab, setActiveTab] = useState<DetailTab>('summary');
  const [aiSettings, setAiSettings] = useState<AiSettingsPublic | null>(null);
  const [summaryProvider, setSummaryProvider] = useState<AiProvider | null>(
    null
  );
  const [summaryModel, setSummaryModel] = useState<string | null>(null);
  const [summaryStyle, setSummaryStyle] = useState<AiSummaryStyle | null>(null);
  const [whisperModel, setWhisperModel] = useState<string | null>(null);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const texts = useRecordingTexts(item);
  const mp4 = useMp4Export(item, onRefresh);
  const whisper = useInstalledWhisperModels();

  const { entry, job } = item;
  const mp4Path = entry?.mp4Path ?? null;
  const artifacts = getRecordingArtifactPaths(item.recordingPath);
  const isBusy =
    job != null && (job.status === 'queued' || job.status === 'processing');
  const isSending = sendingKey != null;
  const canTranscribe = entry?.hasPcmSidecar ?? false;
  const isVideo = item.mediaKind === 'screen-share-video';
  const hasWhisperModels = whisper.models.length > 0;
  const usedModelLabel =
    entry?.transcriptWhisperModelLabel ??
    (entry?.transcriptWhisperModelFileName != null
      ? getWhisperModelLabel(entry.transcriptWhisperModelFileName)
      : null);
  const transcribeModelLabel = formatTranscribeModelLabel(
    whisperModel,
    whisper.activeFileName
  );

  // Volby přegenerování startují na tom, co má uživatel v Nastavení AI —
  // ať v nabídce vidí konkrétní model a styl, ne odkaz na nastavení.
  useEffect(() => {
    drop(
      (async () => {
        try {
          const settings = await getAiSettings();
          setAiSettings(settings);
          setSummaryProvider(settings.provider);
          setSummaryModel(settings.model);
          setSummaryStyle(settings.summaryStyle);
        } catch {
          setAiSettings(null);
        }
      })()
    );
  }, []);

  useEffect(() => {
    setIsEditingSummary(false);
    setSaveError(null);
  }, [item.recordingPath]);

  // Kliknutí na nález hledání otevře tab, ve kterém nález je. Jinak platí,
  // že nahrávka bez shrnutí nemá co ukazovat ve výchozím tabu.
  const hitSource = searchHit?.source ?? null;
  const hitIndex = searchHit?.index ?? -1;
  useEffect(() => {
    if (hitSource != null) {
      setActiveTab(hitSource === 'summary' ? 'summary' : 'transcript');
      return;
    }
    setActiveTab(item.hasSummary ? 'summary' : 'transcript');
  }, [item.recordingPath, item.hasSummary, hitSource, hitIndex]);

  const highlightFor = useCallback(
    (source: RecordingTextHit['source']): MinutesTextHighlight | null => {
      if (searchQuery.trim().length === 0) {
        return null;
      }
      return {
        query: searchQuery,
        activeIndex: hitSource === source ? hitIndex : -1,
      };
    },
    [searchQuery, hitSource, hitIndex]
  );

  const openInFolder = useCallback((path: string) => {
    ipcRenderer.send('show-item-in-folder', path);
  }, []);

  const regenerateSummary = useCallback(() => {
    onEnqueueSummary(item, {
      summaryProvider: summaryProvider ?? undefined,
      summaryModel: summaryModel ?? undefined,
      summaryStyle: summaryStyle ?? undefined,
    });
  }, [item, onEnqueueSummary, summaryModel, summaryProvider, summaryStyle]);

  const startTranscription = useCallback(() => {
    onEnqueueTranscription(item, {
      whisperModelFileName: whisperModel ?? undefined,
    });
  }, [item, onEnqueueTranscription, whisperModel]);

  const handleSaveSummary = useCallback(
    (markdown: string) => {
      setIsSavingSummary(true);
      setSaveError(null);
      drop(
        (async () => {
          try {
            await saveRecordingSummary(item.recordingPath, markdown);
            setIsEditingSummary(false);
            onRefresh();
          } catch (error) {
            setSaveError(error);
          } finally {
            setIsSavingSummary(false);
          }
        })()
      );
    },
    [item.recordingPath, onRefresh]
  );

  // Schůzka je vidět vždy — i bez vazby, aby tam šel zápis teprve založit.
  const detailTabs = useMemo(
    (): ReadonlyArray<readonly [DetailTab, string]> => [
      ['summary', 'Shrnutí'],
      ['transcript', 'Přepis'],
      ['media', isVideo ? 'Video' : 'Nahrávka'],
      ['meeting', 'Schůzka'],
    ],
    [isVideo]
  );

  // Jména řečníků slouží AI jako seznam možných řešitelů úkolů.
  const transcriptSpeakers = useMemo(
    () =>
      listTranscriptSpeakers(parseTranscriptSegments(texts?.transcript ?? '')),
    [texts?.transcript]
  );

  const isMeetingConfirmable =
    meetingLink?.activity != null &&
    isUubtMeetingSolvableByMe(meetingLink.activity);

  const confirmMeetingMinutes = useCallback(async () => {
    const activity = meetingLink?.activity;
    if (activity == null || meetingLink == null) {
      return;
    }

    await markUubtMeetingSolved(
      activity,
      'Zápis vložen z Minutes a schůzka uzavřena.'
    );
    onMeetingLinkChange({
      ...meetingLink,
      activity: { ...activity, stateCode: UUBT_ACTIVITY_STATE_SOLVED },
    });
  }, [meetingLink, onMeetingLinkChange]);

  const meetingButtonHint = !item.hasSummary
    ? 'Zápis se posílá ze shrnutí — nejdřív ho vygenerujte.'
    : 'Zapněte Plus4U integraci a uložte oba přístupové kódy v Nastavení AI.';
  const canWriteToMeeting = item.hasSummary && isUubtEnabled && !isSending;

  return (
    <div className="MinutesTranscriptsTab__detail">
      {isConfirmingDelete && (
        <DeleteConfirmDialog
          item={item}
          onCancel={() => setIsConfirmingDelete(false)}
          onConfirm={() => {
            setIsConfirmingDelete(false);
            onDelete(item);
          }}
        />
      )}

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

          <span className="MinutesTranscriptsTab__actionsSpacer" />

          <MinutesIconButton
            icon="trash"
            tone="danger"
            label="Smazat nahrávku i všechny soubory"
            disabled={isBusy}
            onClick={() => setIsConfirmingDelete(true)}
          />
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

        <div className="MinutesTranscriptsTab__detailTabs">
          <div
            className="MinutesTranscriptsTab__detailTabList"
            role="tablist"
            aria-label="Obsah nahrávky"
          >
            {detailTabs.map(([value, label]) => (
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

          {/* Soubory nejsou obsah nahrávky, proto jen vypadají jako další
              záložka a rozbalí nabídku — do tablistu tedy nepatří. */}
          <AxoDropdownMenu.Root>
            <AxoDropdownMenu.Trigger>
              <button
                type="button"
                className="MinutesTranscriptsTab__detailTab MinutesTranscriptsTab__detailTab--menu"
              >
                <MinutesIcon name="folder" />
                Soubory
              </button>
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
        </div>
      </header>

      <div className="MinutesTranscriptsTab__detailBody">
        {activeTab === 'summary' && (
          <>
            <div className="MinutesTranscriptsTab__paneToolbar">
              <WriteToMeetingButton
                label="Zapsat ke schůzce Plus4U"
                hint={meetingButtonHint}
                isEnabled={canWriteToMeeting}
                onClick={() => onWriteToMeeting(item)}
              />

              <AxoButton.Root
                variant={item.hasSummary ? 'subtle-primary' : 'strong-primary'}
                size="sm"
                disabled={isBusy || !item.hasTranscript}
                onClick={regenerateSummary}
              >
                {item.hasSummary
                  ? 'Přegenerovat shrnutí'
                  : 'Vygenerovat shrnutí'}
              </AxoButton.Root>

              <MinutesOptionsPopover icon="options" label="Volby shrnutí">
                {() => (
                  <SummaryOptionsPanel
                    aiSettings={aiSettings}
                    provider={summaryProvider}
                    model={summaryModel}
                    style={summaryStyle}
                    onProviderModelChange={(provider, model) => {
                      setSummaryProvider(provider);
                      setSummaryModel(model);
                    }}
                    onStyleChange={setSummaryStyle}
                  />
                )}
              </MinutesOptionsPopover>

              {item.hasSummary && (
                <MinutesIconButton
                  icon="pencil"
                  label={
                    isEditingSummary
                      ? 'Zavřít editaci shrnutí'
                      : 'Upravit text shrnutí'
                  }
                  isActive={isEditingSummary}
                  onClick={() => setIsEditingSummary(value => !value)}
                />
              )}

              <SharePanel
                kind="summary"
                item={item}
                isSelfChat={isSelfChat}
                isSending={isSending}
                onSend={onSend}
              />
            </div>

            {saveError != null && (
              <ErrorNotice title="Shrnutí se neuložilo" error={saveError} />
            )}

            {isEditingSummary ? (
              <MinutesSummaryEditor
                markdown={texts?.summary ?? ''}
                isSaving={isSavingSummary}
                onSave={handleSaveSummary}
                onCancel={() => setIsEditingSummary(false)}
              />
            ) : (
              <SummaryPane
                texts={texts}
                hasTranscript={item.hasTranscript}
                highlight={highlightFor('summary')}
              />
            )}
          </>
        )}

        {activeTab === 'transcript' && (
          <>
            <div className="MinutesTranscriptsTab__paneToolbar">
              <AxoButton.Root
                variant={
                  item.hasTranscript ? 'subtle-primary' : 'strong-primary'
                }
                size="sm"
                disabled={isBusy || !canTranscribe}
                onClick={startTranscription}
              >
                {item.hasTranscript
                  ? `Přepsat znovu (${transcribeModelLabel})`
                  : 'Spustit přepis'}
              </AxoButton.Root>

              <span
                className="MinutesTranscriptsTab__hintWrap"
                title={hasWhisperModels ? undefined : NO_WHISPER_MODEL_HINT}
              >
                <MinutesOptionsPopover
                  icon="options"
                  label="Volba modelu přepisu"
                  disabled={!hasWhisperModels}
                >
                  {() => (
                    <WhisperModelPanel
                      models={whisper.models}
                      activeFileName={whisper.activeFileName}
                      selected={whisperModel}
                      onSelect={setWhisperModel}
                    />
                  )}
                </MinutesOptionsPopover>
              </span>

              <SharePanel
                kind="transcript"
                item={item}
                isSelfChat={isSelfChat}
                isSending={isSending}
                onSend={onSend}
              />
            </div>

            <TranscriptPane
              texts={texts}
              canTranscribe={canTranscribe}
              highlight={highlightFor('transcript')}
            />
          </>
        )}

        {activeTab === 'media' && <MinutesRecordingPlayer item={item} />}

        {activeTab === 'meeting' && (
          <>
            <div className="MinutesTranscriptsTab__paneToolbar">
              <WriteToMeetingButton
                label={
                  meetingLink != null
                    ? 'Zapsat k jiné schůzce'
                    : 'Zapsat ke schůzce Plus4U'
                }
                hint={meetingButtonHint}
                isEnabled={canWriteToMeeting}
                onClick={() => onWriteToMeeting(item)}
              />
            </div>

            {meetingLink != null ? (
              <MinutesRecordingMeetingPane
                link={meetingLink}
                conversationId={item.conversationId}
                sourceChatTitle={item.conversationTitle}
                isSelfChat={isSelfChat}
                summaryMarkdown={texts?.summary ?? ''}
                participants={transcriptSpeakers}
                isSharing={isSending}
                isConfirmable={isMeetingConfirmable}
                onUpdated={onMeetingLinkChange}
                onShareSummary={target =>
                  onSend(
                    item,
                    target === 'self' ? 'summary-self' : 'summary-chat'
                  )
                }
                onConfirmMinutes={confirmMeetingMinutes}
              />
            ) : (
              <p className="MinutesTranscriptsTab__note">
                Nahrávka není navázaná na žádnou schůzku v Plus4U. Tlačítkem
                nahoře vložíte shrnutí do sekce Zápis vybrané schůzky — pak se
                tady objeví její detail, příprava i návrhy úkolů.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryPane({
  texts,
  hasTranscript,
  highlight,
}: Readonly<{
  texts: RecordingTexts | null;
  hasTranscript: boolean;
  highlight: MinutesTextHighlight | null;
}>): JSX.Element {
  if (texts == null) {
    return <p className="MinutesTranscriptsTab__note">Načítám shrnutí…</p>;
  }
  if (texts.summary.length > 0) {
    return <MinutesMarkdown source={texts.summary} highlight={highlight} />;
  }
  return (
    <p className="MinutesTranscriptsTab__note">
      {hasTranscript
        ? 'Shrnutí zatím není. Vygenerujte ho tlačítkem nahoře — pod ikonou voleb si můžete vybrat model i styl.'
        : 'Shrnutí vzniká z přepisu. Nejdřív nahrávku přepište.'}
    </p>
  );
}

function TranscriptPane({
  texts,
  canTranscribe,
  highlight,
}: Readonly<{
  texts: RecordingTexts | null;
  canTranscribe: boolean;
  highlight: MinutesTextHighlight | null;
}>): JSX.Element {
  if (texts == null) {
    return <p className="MinutesTranscriptsTab__note">Načítám přepis…</p>;
  }
  if (texts.transcript.length > 0) {
    return (
      <MinutesTranscriptView
        transcript={texts.transcript}
        highlight={highlight}
      />
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
