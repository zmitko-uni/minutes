// Copyright 2026 minutes contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState, type JSX } from 'react';

import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { drop } from '../../util/drop.std.ts';
import { openLinkInWebBrowser } from '../../util/openLinkInWebBrowser.dom.ts';
import { formatUserFacingError } from '../friendlyError.std.ts';
import {
  formatMeetingDay,
  formatMeetingInsertMode,
  formatMeetingInsertedAt,
  type RecordingMeetingLink,
} from '../recordingMeeting.std.ts';
import { sendSignalChatMessage } from '../sendSignalChatMessage.preload.ts';
import type { UubtMeetingActivity, UubtMeetingTexts } from '../uubt.std.ts';
import {
  formatUubtMeetingTimeRange,
  toUubtDayString,
  UUBT_ACTIVITY_STATE_SOLVED,
} from '../uubt.std.ts';
import {
  listUubtMeetings,
  loadUubtMeetingTexts,
} from '../uubtService.preload.ts';
import { MinutesConfirmDialog } from './MinutesConfirmDialog.dom.tsx';
import {
  MinutesIconButton,
  MinutesOptionsPopover,
} from './MinutesIconButton.dom.tsx';
import { MinutesMeetingTasksPanel } from './MinutesMeetingTasksPanel.dom.tsx';

/** Kdo má schůzku uzavřít — a jestli je to přihlášený uživatel. */
function formatSolverValue(activity: UubtMeetingActivity | null): string {
  if (activity == null) {
    return 'Plus4U u schůzky řešitele neuvedlo';
  }

  const who = activity.isMine ? 'vy' : (activity.solverName ?? 'někdo jiný');
  return activity.stateCode === UUBT_ACTIVITY_STATE_SOLVED
    ? `${who} — už potvrzeno`
    : who;
}

function meetingWhenLabel(link: RecordingMeetingLink): string {
  return [formatMeetingDay(link), formatUubtMeetingTimeRange(link)]
    .filter(value => value.length > 0)
    .join(', ');
}

/** Jeden řádek sdílení: co se posílá a kam. */
function ShareRow({
  what,
  isDisabled,
  isSelfChat,
  onShare,
}: Readonly<{
  what: string;
  isDisabled: boolean;
  isSelfChat: boolean;
  onShare: (target: 'chat' | 'self') => void;
}>): JSX.Element {
  return (
    <div className="MinutesOptionsPopover__actionRow">
      <span className="MinutesOptionsPopover__actionLabel">{what}</span>
      <AxoButton.Root
        variant="subtle-primary"
        size="sm"
        disabled={isDisabled}
        onClick={() => onShare('chat')}
      >
        Do chatu
      </AxoButton.Root>
      {!isSelfChat && (
        <AxoButton.Root
          variant="subtle-primary"
          size="sm"
          disabled={isDisabled}
          onClick={() => onShare('self')}
        >
          Sobě
        </AxoButton.Root>
      )}
    </div>
  );
}

function MeetingRow({
  label,
  value,
}: Readonly<{ label: string; value: string }>): JSX.Element {
  return (
    <div className="MinutesMeetingPane__row">
      <span className="MinutesMeetingPane__label">{label}</span>
      <span className="MinutesMeetingPane__value">{value}</span>
    </div>
  );
}

/**
 * Základní informace o schůzce, do které šel zápis. Data jsou z posledního
 * načtení z Plus4U a dají se obnovit.
 */
export function MinutesRecordingMeetingPane({
  link,
  conversationId,
  sourceChatTitle,
  isSelfChat,
  summaryMarkdown,
  participants,
  isSharing,
  isConfirmable,
  onUpdated,
  onShareSummary,
  onConfirmMinutes,
}: Readonly<{
  link: RecordingMeetingLink;
  conversationId: string;
  sourceChatTitle: string;
  isSelfChat: boolean;
  summaryMarkdown: string;
  participants: ReadonlyArray<string>;
  isSharing: boolean;
  /** Schůzku smí uzavřít jen její řešitel. */
  isConfirmable: boolean;
  onUpdated: (link: RecordingMeetingLink) => void;
  onShareSummary: (target: 'chat' | 'self') => void;
  onConfirmMinutes: () => Promise<void>;
}>): JSX.Element {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmingDialogOpen, setIsConfirmingDialogOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [texts, setTexts] = useState<UubtMeetingTexts | null>(null);
  const [isLoadingTexts, setIsLoadingTexts] = useState(false);

  const confirmMinutes = useCallback(() => {
    setIsConfirming(true);
    setErrorMessage(null);
    drop(
      (async () => {
        try {
          await onConfirmMinutes();
        } catch (error) {
          setErrorMessage(formatUserFacingError(error));
        } finally {
          setIsConfirming(false);
        }
      })()
    );
  }, [onConfirmMinutes]);

  // Příprava a už vložený zápis se čtou přímo ze stránky schůzky v Plus4U.
  const loadTexts = useCallback(() => {
    setIsLoadingTexts(true);
    drop(
      (async () => {
        try {
          setTexts(
            await loadUubtMeetingTexts({
              meetingBaseUri: link.meetingBaseUri,
              meetingId: link.meetingId,
            })
          );
        } catch (error) {
          setTexts(null);
          setErrorMessage(formatUserFacingError(error));
        } finally {
          setIsLoadingTexts(false);
        }
      })()
    );
  }, [link.meetingBaseUri, link.meetingId]);

  useEffect(() => {
    loadTexts();
  }, [loadTexts]);

  const preparation = texts?.preparation ?? '';
  const meetingMinutes = texts?.minutes ?? '';
  const meetingParticipants = texts?.participants ?? [];

  const sharePreparation = useCallback(
    (target: 'chat' | 'self') => {
      const targetId =
        target === 'self'
          ? window.ConversationController?.getOurConversationId()
          : conversationId;
      if (targetId == null || targetId.length === 0) {
        return;
      }

      const header = [meetingWhenLabel(link), sourceChatTitle]
        .filter(value => value.length > 0)
        .join(' · ');

      drop(
        sendSignalChatMessage(
          targetId,
          `**Příprava na schůzku — ${link.name}**${
            header.length > 0 ? `\n${header}` : ''
          }\n\n${preparation}`,
          'minutes/meeting-preparation'
        )
      );
    },
    [conversationId, link, preparation, sourceChatTitle]
  );

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setErrorMessage(null);
    loadTexts();

    drop(
      (async () => {
        try {
          const day = toUubtDayString(new Date(link.startTime).getTime());
          const meetings = await listUubtMeetings(day);
          const fresh = meetings.find(
            meeting => meeting.meetingId === link.meetingId
          );
          if (fresh == null) {
            setErrorMessage(
              'Schůzku už v kalendáři na daný den nevidíme. Mohla být přesunutá nebo zrušená.'
            );
            return;
          }
          onUpdated({
            ...link,
            name: fresh.name,
            startTime: fresh.startTime,
            endTime: fresh.endTime,
            location: fresh.location,
            organizer: fresh.organizer,
            meetingUrl: fresh.meetingUrl ?? link.meetingUrl,
            activity: fresh.activity ?? link.activity ?? null,
          });
        } catch (error) {
          setErrorMessage(formatUserFacingError(error));
        } finally {
          setIsRefreshing(false);
        }
      })()
    );
  }, [link, loadTexts, onUpdated]);

  const timeRange = formatUubtMeetingTimeRange(link);
  const meetingDay = formatMeetingDay(link);

  return (
    <div className="MinutesMeetingPane">
      {isConfirmingDialogOpen && (
        <MinutesConfirmDialog
          title="Potvrdit zápis ze schůzky?"
          description={`Schůzka „${link.name}“ se v Plus4U označí za vyřešenou se zápisem, který jste do ní zapsali. Další úpravy zápisu už se do ní nepropíšou.`}
          confirmLabel="Potvrdit zápis"
          cancelLabel="Ještě ne"
          tone="primary"
          onCancel={() => setIsConfirmingDialogOpen(false)}
          onConfirm={() => {
            setIsConfirmingDialogOpen(false);
            confirmMinutes();
          }}
        />
      )}

      <h3 className="MinutesMeetingPane__title">{link.name}</h3>

      <div className="MinutesMeetingPane__grid">
        <MeetingRow label="Den" value={formatMeetingDay(link) || '—'} />
        <MeetingRow label="Čas" value={timeRange || '—'} />
        <MeetingRow
          label="Místo"
          value={link.location.length > 0 ? link.location : '—'}
        />
        <MeetingRow label="Organizátor" value={link.organizer ?? '—'} />
        <MeetingRow
          label="Zápis provede"
          value={formatSolverValue(link.activity ?? null)}
        />
        <MeetingRow
          label="Účastníci"
          value={
            meetingParticipants.length > 0
              ? meetingParticipants.join(', ')
              : isLoadingTexts
                ? 'Načítám…'
                : '—'
          }
        />
        <MeetingRow
          label="Vloženo"
          value={`${formatMeetingInsertedAt(link)} — ${formatMeetingInsertMode(link)}`}
        />
      </div>

      {isConfirmable && (
        <p className="MinutesMeetingPane__solverNote">
          Zápis z této schůzky máte v Plus4U provést vy. Tlačítkem níž ho
          potvrdíte a aktivita se uloží jako vyřešená.
        </p>
      )}

      {errorMessage != null && (
        <p className="MinutesMeetingPane__error">{errorMessage}</p>
      )}

      <div className="MinutesMeetingPane__actions">
        {isConfirmable && (
          <button
            type="button"
            className="MinutesMeetingPane__confirmButton"
            disabled={isConfirming}
            onClick={() => setIsConfirmingDialogOpen(true)}
          >
            {isConfirming ? 'Potvrzuji…' : 'Potvrdit zápis ze schůzky'}
          </button>
        )}
        <MinutesOptionsPopover
          icon="share"
          label={isSharing ? 'Odesílám…' : 'Sdílet zápis nebo přípravu'}
          disabled={isSharing}
        >
          {close => (
            <div className="MinutesOptionsPopover__actions">
              <ShareRow
                what="Zápis"
                isDisabled={summaryMarkdown.trim().length === 0}
                isSelfChat={isSelfChat}
                onShare={target => {
                  close();
                  onShareSummary(target);
                }}
              />
              <ShareRow
                what="Příprava"
                isDisabled={preparation.length === 0}
                isSelfChat={isSelfChat}
                onShare={target => {
                  close();
                  sharePreparation(target);
                }}
              />
              <p className="MinutesOptionsPopover__hint">
                {isSelfChat
                  ? 'Odešle text jako zprávu do tohoto chatu.'
                  : `Do chatu = ${sourceChatTitle}. Sobě = vaše poznámky.`}
              </p>
            </div>
          )}
        </MinutesOptionsPopover>

        {link.meetingUrl != null && (
          <MinutesIconButton
            icon="open"
            label="Otevřít schůzku v prohlížeči"
            onClick={() => openLinkInWebBrowser(link.meetingUrl ?? '')}
          />
        )}

        <MinutesIconButton
          icon="refresh"
          label={
            isRefreshing || isLoadingTexts
              ? 'Načítám…'
              : 'Aktualizovat informace ze schůzky'
          }
          disabled={isRefreshing || isLoadingTexts}
          onClick={refresh}
        />
      </div>

      <section className="MinutesMeetingPane__section">
        <h4 className="MinutesMeetingPane__sectionTitle">Příprava</h4>
        {isLoadingTexts && texts == null ? (
          <p className="MinutesMeetingPane__note">Načítám přípravu…</p>
        ) : preparation.length > 0 ? (
          <p className="MinutesMeetingPane__text">{preparation}</p>
        ) : (
          <p className="MinutesMeetingPane__note">
            Schůzka nemá v Plus4U vyplněnou přípravu.
          </p>
        )}
      </section>

      <section className="MinutesMeetingPane__section">
        <h4 className="MinutesMeetingPane__sectionTitle">Zápis ze schůzky</h4>
        {isLoadingTexts && texts == null ? (
          <p className="MinutesMeetingPane__note">Načítám zápis…</p>
        ) : meetingMinutes.length > 0 ? (
          <p className="MinutesMeetingPane__text">{meetingMinutes}</p>
        ) : (
          <p className="MinutesMeetingPane__note">
            V sekci Zápis v Plus4U zatím nic není.
          </p>
        )}
      </section>

      <MinutesMeetingTasksPanel
        meetingName={link.name}
        meetingWhen={[meetingDay, timeRange].filter(Boolean).join(', ')}
        sourceChatTitle={sourceChatTitle}
        minutesMarkdown={summaryMarkdown}
        participants={[...new Set([...meetingParticipants, ...participants])]}
      />
    </div>
  );
}
