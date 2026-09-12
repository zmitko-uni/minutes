// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useState, type JSX } from 'react';
import { useSelector } from 'react-redux';
import { ipcRenderer } from 'electron';

import {
  NavSidebar,
  NavSidebarSearchHeader,
} from '../../components/NavSidebar.dom.tsx';
import { SearchInput } from '../../components/SearchInput.dom.tsx';
import { getIntl } from '../../state/selectors/user.std.ts';
import {
  getNavTabsCollapsed,
  getPreferredLeftPaneWidth,
} from '../../state/selectors/items.dom.ts';
import { getOtherTabsUnreadStats } from '../../state/selectors/conversations.dom.ts';
import { getHasPendingUpdate } from '../../state/selectors/updates.std.ts';
import { getHasAnyFailedStorySends } from '../../state/selectors/stories.preload.ts';
import { useItemsActions } from '../../state/ducks/items.preload.ts';
import { renderToastManagerWithoutMegaphone } from '../../state/smart/ToastManager.preload.tsx';
import { ToastType } from '../../types/Toast.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import {
  clearMinutesConversationFilter,
  getMinutesConversationFilter,
  subscribeMinutesConversationFilter,
} from '../navTabsService.preload.ts';
import type { RecordingMeetingLink } from '../recordingMeeting.std.ts';
import {
  deleteCallRecording,
  getRecordingMeeting,
  saveRecordingMeeting,
} from '../recordingFilesService.preload.ts';
import type { CallRecordingCatalogEntry } from '../recordingsCatalog.std.ts';
import {
  buildRecordingListItems,
  RECORDING_LIST_FILTERS,
  type RecordingListFilter,
  type RecordingListItem,
} from '../recordingsListModel.std.ts';
import type { RecordingTextMatch } from '../recordingsSearch.std.ts';
import { searchRecordingTexts } from '../recordingsSearchService.preload.ts';
import {
  loadCallRecordingOutputFromEntry,
  sendCallSummaryToChat,
  sendCallTranscriptToChat,
} from '../sendCallRecordingToChat.preload.ts';
import {
  formatEta,
  formatJobStatus,
  formatRecordingDuration,
  formatRecordingWhen,
} from '../transcriptionStatusFormat.std.ts';
import { subscribeTranscriptionQueue } from '../transcriptionQueueEvents.std.ts';
import { transcriptionQueue } from '../transcriptionQueueService.preload.ts';
import type {
  TranscriptionJobOptions,
  TranscriptionQueueSnapshot,
} from '../transcriptionQueue.std.ts';
import type { CallRecordingOutput } from '../types.std.ts';
import { getUubtSettings } from '../uubtService.preload.ts';
import {
  MinutesRecordingDetail,
  type RecordingSendAction,
} from './MinutesRecordingDetail.dom.tsx';
import { MinutesIconButton } from './MinutesIconButton.dom.tsx';
import { MinutesConfirmDialog } from './MinutesConfirmDialog.dom.tsx';
import { MinutesSendToUubtModal } from './MinutesSendToUubtModal.dom.tsx';
import type { UubtSendTarget } from './MinutesSendToUubtModal.dom.tsx';
import type { UubtMeeting } from '../uubt.std.ts';

const EMPTY_SNAPSHOT: TranscriptionQueueSnapshot = {
  jobs: [],
  queuePaused: false,
  activeJobId: null,
  panelOpen: false,
};

async function performSendAction(
  output: CallRecordingOutput,
  action: RecordingSendAction
): Promise<void> {
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
}

function toMeetingLink(
  meeting: UubtMeeting,
  mode: RecordingMeetingLink['mode']
): RecordingMeetingLink {
  return {
    version: 1,
    meetingId: meeting.meetingId,
    meetingBaseUri: meeting.meetingBaseUri,
    meetingUrl: meeting.meetingUrl,
    name: meeting.name,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    organizer: meeting.organizer,
    insertedAt: Date.now(),
    mode,
    activity: meeting.activity,
  };
}

async function resolveOutput(
  item: RecordingListItem
): Promise<CallRecordingOutput | null> {
  if (item.entry != null) {
    return loadCallRecordingOutputFromEntry(item.entry);
  }
  return item.job?.output ?? null;
}

function formatEmptyListMessage(
  isLoading: boolean,
  totalRecordings: number
): string {
  if (isLoading) {
    return 'Načítám nahrávky…';
  }
  if (totalRecordings === 0) {
    return 'Zatím žádné nahrávky. Po ukončení hovoru se sem záznam zařadí sám a přepis se spustí na pozadí.';
  }
  return 'Hledání ani filtr nic nenašly.';
}

function RecordingListRow({
  item,
  jobs,
  isSelected,
  onSelect,
  onOpenChat,
  onDelete,
}: Readonly<{
  item: RecordingListItem;
  jobs: ReadonlyArray<TranscriptionQueueSnapshot['jobs'][number]>;
  isSelected: boolean;
  onSelect: () => void;
  onOpenChat: (() => void) | null;
  onDelete: () => void;
}>): JSX.Element {
  const { job } = item;
  const eta = job != null ? formatEta(job) : null;
  const itemClassName = ['MinutesTranscriptsTab__item']
    .concat(item.isPinned ? ['MinutesTranscriptsTab__item--pinned'] : [])
    .join(' ');

  return (
    <li className="MinutesTranscriptsTab__row">
      <button
        type="button"
        className={itemClassName}
        aria-current={isSelected}
        onClick={onSelect}
      >
        <span className="MinutesTranscriptsTab__itemTitle">
          {item.conversationTitle}
        </span>

        <span className="MinutesTranscriptsTab__itemMeta">
          {formatRecordingWhen(item.startedAt)}
          {item.durationMs > 0
            ? ` · ${formatRecordingDuration(item.durationMs)}`
            : ''}
          {item.mediaKind === 'screen-share-video' ? ' · Video' : ''}
        </span>

        {item.isPinned && job != null ? (
          <>
            <span
              className={['MinutesTranscriptsTab__itemStatus']
                .concat(
                  job.status === 'failed'
                    ? ['MinutesTranscriptsTab__itemStatus--failed']
                    : []
                )
                .join(' ')}
            >
              {formatJobStatus(job, jobs)}
              {eta != null ? ` · ${eta}` : ''}
            </span>
            {job.status === 'processing' && (
              <span className="MinutesTranscriptsTab__progress">
                <span
                  className="MinutesTranscriptsTab__progressBar"
                  style={{ width: `${job.progress}%` }}
                />
              </span>
            )}
          </>
        ) : (
          <span className="MinutesTranscriptsTab__itemTags">
            {item.hasTranscript && (
              <span className="MinutesTranscriptsTab__tag">Přepis</span>
            )}
            {item.hasSummary && (
              <span className="MinutesTranscriptsTab__tag">Shrnutí</span>
            )}
            {!item.hasTranscript && !item.hasSummary && (
              <span className="MinutesTranscriptsTab__tag MinutesTranscriptsTab__tag--muted">
                Jen nahrávka
              </span>
            )}
          </span>
        )}

        {item.snippet != null && (
          <span className="MinutesTranscriptsTab__itemSnippet">
            {item.snippet}
          </span>
        )}
      </button>

      <span className="MinutesTranscriptsTab__rowActions">
        {onOpenChat != null && (
          <MinutesIconButton
            icon="chat"
            label="Otevřít chat této nahrávky"
            onClick={onOpenChat}
          />
        )}
        <MinutesIconButton
          icon="trash"
          tone="danger"
          label="Smazat nahrávku i všechny soubory"
          onClick={onDelete}
        />
      </span>
    </li>
  );
}

export function MinutesTranscriptsTab(): JSX.Element {
  const i18n = useSelector(getIntl);
  const navTabsCollapsed = useSelector(getNavTabsCollapsed);
  const preferredLeftPaneWidth = useSelector(getPreferredLeftPaneWidth);
  const otherTabsUnreadStats = useSelector(getOtherTabsUnreadStats);
  const hasPendingUpdate = useSelector(getHasPendingUpdate);
  const hasFailedStorySends = useSelector(getHasAnyFailedStorySends);
  const { savePreferredLeftPaneWidth, toggleNavTabsCollapse } =
    useItemsActions();

  const [entries, setEntries] = useState<
    ReadonlyArray<CallRecordingCatalogEntry>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [snapshot, setSnapshot] =
    useState<TranscriptionQueueSnapshot>(EMPTY_SNAPSHOT);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [textMatches, setTextMatches] = useState<
    ReadonlyArray<RecordingTextMatch>
  >([]);
  const [filter, setFilter] = useState<RecordingListFilter>('all');
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RecordingListItem | null>(
    null
  );
  const [uubtTarget, setUubtTarget] = useState<UubtSendTarget | null>(null);
  const [isUubtEnabled, setIsUubtEnabled] = useState(false);
  const [meetingLink, setMeetingLink] = useState<RecordingMeetingLink | null>(
    null
  );
  // Tlačítko „M“ v chatu otevře tab zúžený jen na nahrávky toho chatu.
  const [conversationFilter, setConversationFilter] = useState<string | null>(
    () => getMinutesConversationFilter()
  );
  // Překresluje odhady zbývajícího času v seznamu i v detailu.
  const [, setEtaTick] = useState(0);

  const refresh = useCallback(() => {
    drop(
      (async () => {
        setIsLoading(true);
        try {
          const loaded = (await ipcRenderer.invoke(
            'minutes:list-call-recordings'
          )) as Array<CallRecordingCatalogEntry> | undefined;
          setEntries(loaded ?? []);
        } finally {
          setIsLoading(false);
        }
      })()
    );
  }, []);

  useEffect(() => subscribeTranscriptionQueue(setSnapshot), []);

  useEffect(
    () => subscribeMinutesConversationFilter(setConversationFilter),
    []
  );

  // Zápis ke schůzce vyžaduje zapnutou integraci i oba uložené přístupové kódy.
  // Čte se při přepnutí nahrávky a po návratu do okna, aby se změna v
  // Nastavení AI projevila bez restartu.
  useEffect(() => {
    const readSettings = (): void => {
      drop(
        (async () => {
          try {
            const settings = await getUubtSettings();
            setIsUubtEnabled(settings.enabled && settings.hasCredentials);
          } catch {
            setIsUubtEnabled(false);
          }
        })()
      );
    };

    readSettings();
    window.addEventListener('focus', readSettings);
    return () => window.removeEventListener('focus', readSettings);
  }, [selectedPath]);

  // Vazba na schůzku je souborová, čte se při přepnutí nahrávky.
  useEffect(() => {
    let cancelled = false;
    setMeetingLink(null);
    if (selectedPath == null) {
      return;
    }
    drop(
      (async () => {
        const link = await getRecordingMeeting(selectedPath);
        if (!cancelled) {
          setMeetingLink(link);
        }
      })()
    );
    return () => {
      cancelled = true;
    };
  }, [selectedPath]);

  const activeCount = useMemo(
    () =>
      snapshot.jobs.filter(
        job => job.status === 'queued' || job.status === 'processing'
      ).length,
    [snapshot.jobs]
  );

  // Načte katalog při otevření tabu a znovu po doběhnutí fronty, kdy na disku
  // přibyly nové přepisy nebo shrnutí.
  useEffect(() => {
    if (activeCount === 0) {
      refresh();
    }
  }, [activeCount, refresh]);

  useEffect(() => {
    if (activeCount === 0) {
      return;
    }
    const timer = window.setInterval(
      () => setEtaTick(value => value + 1),
      5000
    );
    return () => window.clearInterval(timer);
  }, [activeCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    if (debouncedQuery.trim().length < 2) {
      setTextMatches([]);
      return;
    }
    drop(
      (async () => {
        const matches = await searchRecordingTexts(debouncedQuery);
        if (!cancelled) {
          setTextMatches(matches);
        }
      })()
    );
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const items = useMemo(
    () =>
      buildRecordingListItems({
        entries,
        jobs: snapshot.jobs,
        textMatches,
        query: debouncedQuery,
        filter,
        conversationId: conversationFilter,
      }),
    [
      entries,
      snapshot.jobs,
      textMatches,
      debouncedQuery,
      filter,
      conversationFilter,
    ]
  );

  const conversationFilterTitle = useMemo(() => {
    if (conversationFilter == null) {
      return null;
    }
    return (
      window.ConversationController?.get(conversationFilter)?.getTitle() ??
      'vybraný chat'
    );
  }, [conversationFilter]);

  const clearConversationFilter = useCallback(() => {
    clearMinutesConversationFilter();
    setConversationFilter(null);
  }, []);

  const handleOpenChat = useCallback((item: RecordingListItem) => {
    window.reduxActions.conversations.showConversation({
      conversationId: item.conversationId,
    });
  }, []);

  const selectedItem = useMemo(
    () => items.find(item => item.recordingPath === selectedPath) ?? null,
    [items, selectedPath]
  );

  const handleEnqueueTranscription = useCallback(
    (item: RecordingListItem, options?: TranscriptionJobOptions) => {
      if (item.entry != null) {
        transcriptionQueue.enqueueFromCatalog(
          item.entry,
          'transcription',
          options
        );
      }
    },
    []
  );

  const handleEnqueueSummary = useCallback(
    (item: RecordingListItem, options?: TranscriptionJobOptions) => {
      if (item.entry != null) {
        transcriptionQueue.enqueueFromCatalog(item.entry, 'summary', options);
      }
    },
    []
  );

  const handleWriteToMeeting = useCallback((item: RecordingListItem) => {
    drop(
      (async () => {
        const output = await resolveOutput(item);
        if (output?.summaryText == null) {
          window.reduxActions.toast.showToast({ toastType: ToastType.Error });
          return;
        }
        setUubtTarget({
          recordingPath: item.recordingPath,
          conversationTitle: item.conversationTitle,
          startedAt: item.startedAt,
          endedAt: item.endedAt,
          summaryMarkdown: output.summaryText,
        });
      })()
    );
  }, []);

  const handleMeetingWritten = useCallback(
    (
      target: UubtSendTarget,
      meeting: UubtMeeting,
      mode: RecordingMeetingLink['mode']
    ) => {
      const link = toMeetingLink(meeting, mode);
      setMeetingLink(link);
      drop(saveRecordingMeeting(target.recordingPath, link));
    },
    []
  );

  const handleMeetingLinkChange = useCallback(
    (link: RecordingMeetingLink) => {
      setMeetingLink(link);
      if (selectedPath != null) {
        drop(saveRecordingMeeting(selectedPath, link));
      }
    },
    [selectedPath]
  );

  const handleDelete = useCallback(
    (item: RecordingListItem) => {
      setPendingDelete(null);
      drop(
        (async () => {
          try {
            await deleteCallRecording(item.recordingPath);
            setSelectedPath(current =>
              current === item.recordingPath ? null : current
            );
          } catch {
            window.reduxActions.toast.showToast({ toastType: ToastType.Error });
          } finally {
            refresh();
          }
        })()
      );
    },
    [refresh]
  );

  const handleSend = useCallback(
    (item: RecordingListItem, action: RecordingSendAction) => {
      if (sendingKey != null) {
        return;
      }
      setSendingKey(`${item.recordingPath}:${action}`);

      drop(
        (async () => {
          try {
            const output = await resolveOutput(item);
            if (output == null) {
              window.reduxActions.toast.showToast({
                toastType: ToastType.Error,
              });
              return;
            }
            await performSendAction(output, action);
          } finally {
            setSendingKey(null);
          }
        })()
      );
    },
    [sendingKey]
  );

  const selfConversationId =
    window.ConversationController?.getOurConversationId();

  return (
    <div className="MinutesTranscriptsTab">
      <MinutesSendToUubtModal
        target={uubtTarget}
        onClose={() => setUubtTarget(null)}
        onWritten={handleMeetingWritten}
      />

      {pendingDelete != null && (
        <MinutesConfirmDialog
          title="Smazat nahrávku?"
          description={`Smaže se záznam „${pendingDelete.conversationTitle}“ včetně zvuku nebo videa, přepisu, shrnutí, MP4 i metadat. Tuhle akci nelze vzít zpět.`}
          confirmLabel="Smazat"
          cancelLabel="Ponechat"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}

      <NavSidebar
        i18n={i18n}
        title="Minutes"
        hasFailedStorySends={hasFailedStorySends}
        hasPendingUpdate={hasPendingUpdate}
        navTabsCollapsed={navTabsCollapsed}
        onToggleNavTabsCollapse={toggleNavTabsCollapse}
        otherTabsUnreadStats={otherTabsUnreadStats}
        preferredLeftPaneWidth={preferredLeftPaneWidth}
        requiresFullWidth={false}
        savePreferredLeftPaneWidth={savePreferredLeftPaneWidth}
        renderToastManager={renderToastManagerWithoutMegaphone}
      >
        <NavSidebarSearchHeader>
          <SearchInput
            i18n={i18n}
            placeholder="Hledat v nahrávkách i přepisech"
            label="Hledat v nahrávkách i přepisech"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onClear={() => setQuery('')}
          />
        </NavSidebarSearchHeader>

        {conversationFilterTitle != null && (
          <div className="MinutesTranscriptsTab__scopeBar">
            <span>{`Jen chat: ${conversationFilterTitle}`}</span>
            <button type="button" onClick={clearConversationFilter}>
              Zobrazit vše
            </button>
          </div>
        )}

        <div className="MinutesTranscriptsTab__filters">
          {RECORDING_LIST_FILTERS.map(option => (
            <button
              key={option.value}
              type="button"
              className="MinutesTranscriptsTab__filter"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {activeCount > 0 && (
          <div className="MinutesTranscriptsTab__queueBar">
            <span>{`Ve frontě: ${activeCount}`}</span>
            <button
              type="button"
              onClick={() =>
                snapshot.queuePaused
                  ? transcriptionQueue.resumeQueue()
                  : transcriptionQueue.pauseQueue()
              }
            >
              {snapshot.queuePaused ? 'Pokračovat' : 'Pozastavit'}
            </button>
            <button
              type="button"
              onClick={() => transcriptionQueue.cancelAllActive()}
            >
              Zrušit vše
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <p className="MinutesTranscriptsTab__empty">
            {formatEmptyListMessage(isLoading, entries.length)}
          </p>
        ) : (
          <ul className="MinutesTranscriptsTab__list">
            {items.map(item => (
              <RecordingListRow
                key={item.recordingPath}
                item={item}
                jobs={snapshot.jobs}
                isSelected={item.recordingPath === selectedPath}
                onSelect={() => setSelectedPath(item.recordingPath)}
                onOpenChat={
                  item.conversationId.length > 0
                    ? () => handleOpenChat(item)
                    : null
                }
                onDelete={() => setPendingDelete(item)}
              />
            ))}
          </ul>
        )}
      </NavSidebar>

      {selectedItem == null ? (
        <div className="MinutesTranscriptsTab__placeholder">
          <p>
            Vyberte nahrávku vlevo. Zobrazí se shrnutí, celý přepis i přehrávač.
          </p>
        </div>
      ) : (
        <MinutesRecordingDetail
          key={selectedItem.recordingPath}
          item={selectedItem}
          jobs={snapshot.jobs}
          sendingKey={sendingKey}
          isSelfChat={
            selfConversationId != null &&
            selfConversationId === selectedItem.entry?.conversationId
          }
          isUubtEnabled={isUubtEnabled}
          meetingLink={meetingLink}
          onEnqueueTranscription={handleEnqueueTranscription}
          onEnqueueSummary={handleEnqueueSummary}
          onSend={handleSend}
          onWriteToMeeting={handleWriteToMeeting}
          onDelete={handleDelete}
          onMeetingLinkChange={handleMeetingLinkChange}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
